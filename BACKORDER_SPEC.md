# Backorder Subscription and Restock Notification Pipeline

## 1. Objective

This specification adds a backorder notification workflow to the retail platform. When a product has no available inventory, a customer can subscribe to an availability notification. The subscription is persisted as `PENDING`. When the warehouse management system records new stock, it emits an `ItemRestocked` event. The Restock Dispatcher consumes that event, finds matching pending subscriptions, transitions them to `NOTIFYING`, and places channel-specific notification jobs into Redis-backed queues.

The design is intentionally **at-least-once** and idempotent. It assumes that event delivery, queue delivery, and notification-provider callbacks may be retried. It therefore treats event IDs, subscription IDs, and notification idempotency keys as durable business identifiers rather than ephemeral transport metadata.

## 2. Scope and Service Responsibilities

| Component | Responsibility | Persistence / infrastructure |
|---|---|---|
| Customer App | Shows an out-of-stock state and submits a subscription request through the API | Local UI state; server is authoritative |
| Product / Inventory API | Returns availability and accepts the customer’s subscription intent | Routes request to Backorder Service |
| Backorder Service | Validates and creates subscriptions; owns subscription state and uniqueness | PostgreSQL |
| Warehouse Management System | Records receiving activity and publishes restock facts | WMS database plus event producer |
| Event Bus | Delivers `ItemRestocked` events to the Restock Dispatcher | Kafka, Redpanda, or managed equivalent |
| Restock Dispatcher | Matches eligible subscriptions, claims notification work, and enqueues jobs | PostgreSQL transaction plus Redis queues |
| Redis Queue Workers | Consume channel-specific jobs and call providers | Redis Streams or reliable list queues |
| Notification Providers | Deliver email, push, or SMS messages | External provider systems |
| Notification Engine | Records outcomes, applies retry policy, and exposes status | PostgreSQL; optional provider adapters |

## 3. End-to-End Execution Flow

### Phase A — Inventory Check and Subscription Registration

1. The Customer App requests product availability from the Product / Inventory API.
2. The Inventory Service returns `available_quantity: 0` for `product_id = PROD-123`.
3. The Customer App renders **Notify Me When Available** instead of the purchase action.
4. The customer selects a channel preference, such as `PUSH`, and taps the action.
5. The API receives `POST /v1/backorder-subscriptions` with the authenticated `user_id`, `product_id`, `channel_preference`, and an idempotency key.
6. The Backorder Service validates that the product is currently unavailable, validates the channel, and creates a row with state `PENDING`.
7. A unique constraint prevents duplicate active subscriptions for the same `user_id`, `product_id`, and channel. A repeated idempotency key returns the original subscription rather than creating another record.
8. The API returns `201 Created` with the subscription ID and state `PENDING`. The Customer App confirms that the customer will be notified when stock returns.

Example request:

```json
{
  "user_id": "USER-456",
  "product_id": "PROD-123",
  "channel_preference": "PUSH"
}
```

Example response:

```json
{
  "subscription_id": "SUB-9f2c",
  "user_id": "USER-456",
  "product_id": "PROD-123",
  "channel_preference": "PUSH",
  "state": "PENDING"
}
```

### Phase B — Restock Event Publication

1. The Warehouse Management System completes a receiving transaction for `PROD-123`.
2. The WMS persists the stock movement and publishes `ItemRestocked` to the event bus using `product_id` as the partitioning key.
3. The event includes a globally unique `event_id`, the source warehouse, the quantity added, the resulting available quantity, an occurrence timestamp, and a schema version.
4. The event producer uses an outbox or transactional event publisher so a committed stock receipt cannot be separated from its event publication.

Example event:

```json
{
  "event_id": "evt-restock-20260829-00091",
  "event_type": "ItemRestocked",
  "event_version": 1,
  "occurred_at": "2026-08-29T18:30:00Z",
  "product_id": "PROD-123",
  "warehouse_id": "WH-07",
  "quantity_added": 50,
  "available_quantity": 50,
  "correlation_id": "receipt-8821"
}
```

### Phase C — Restock Dispatch and Subscription Claiming

1. The Restock Dispatcher consumes `ItemRestocked` from its consumer group.
2. It first records the event ID in an inbox table. If the event ID already exists, the dispatcher acknowledges the duplicate without re-enqueuing notifications.
3. The dispatcher queries only active `PENDING` subscriptions for the matching product. It processes them in deterministic batches, for example 500 subscriptions per transaction.
4. Within each batch, it changes state from `PENDING` to `NOTIFYING`, stores `notifying_at`, and assigns a notification attempt ID.
5. The state claim and an outbox row are committed in one database transaction. A publisher then transfers the outbox rows to channel-specific Redis queues.
6. The dispatcher acknowledges the event only after all matching work has been claimed or safely recorded for retry. If the event is retried, only still-`PENDING` rows can be claimed.

The query must be index-supported and bounded:

```sql
SELECT id
FROM backorder_subscriptions
WHERE product_id = $1
  AND state = 'PENDING'
ORDER BY id
LIMIT $2
FOR UPDATE SKIP LOCKED;
```

`FOR UPDATE SKIP LOCKED` allows multiple dispatcher replicas to process the same product or different products without waiting on rows already claimed by another worker.

### Phase D — Channel Queueing

1. For every claimed subscription, the dispatcher creates one notification job with a deterministic `idempotency_key`.
2. The job is routed to a channel-specific Redis queue: `notifications:push`, `notifications:email`, or `notifications:sms`.
3. The job payload contains the subscription ID, user ID, product ID, channel, event ID, quantity added, and template data. The customer-facing restock data remains compact and includes `{ product_id, quantity_added }`.
4. Redis Streams are preferred because consumer groups, pending-entry inspection, and acknowledgements provide clearer recovery semantics. If lists are used, implement a processing list, visibility timeout, and dead-letter queue.
5. Queue producers use `SETNX` or a durable notification-outbox uniqueness key so duplicate dispatcher attempts do not create duplicate jobs.

Example job:

```json
{
  "job_id": "JOB-2d11",
  "idempotency_key": "SUB-9f2c:evt-restock-20260829-00091:PUSH",
  "subscription_id": "SUB-9f2c",
  "user_id": "USER-456",
  "product_id": "PROD-123",
  "channel": "PUSH",
  "quantity_added": 50,
  "source_event_id": "evt-restock-20260829-00091"
}
```

### Phase E — Notification Delivery and Final State

1. A channel worker reads a job from its Redis consumer group and loads the subscription and notification attempt.
2. The worker checks the durable idempotency key before calling the provider. If the key is already `SENT`, it acknowledges the Redis message without sending again.
3. The worker sends the channel-specific notification. The message tells the customer that `PROD-123` is available and may include the quantity added without exposing warehouse-only details.
4. On provider acceptance, the worker stores provider reference, `sent_at`, and delivery state `SENT`, then acknowledges the queue message.
5. The Backorder Service transitions the subscription from `NOTIFYING` to `NOTIFIED`. The default policy is one notification per subscription per restock event. The customer may create a new subscription later if the item sells out again.
6. On a retryable failure, the worker increments the attempt count, records the error, and requeues with exponential backoff and jitter. On a permanent failure or exhausted retries, the subscription becomes `FAILED` or returns to `PENDING` according to the product policy.

## 4. Backorder State Machine

| Current state | Trigger | Next state | Notes |
|---|---|---|---|
| `PENDING` | Matching `ItemRestocked` is claimed | `NOTIFYING` | Claim is conditional and transactionally recorded |
| `NOTIFYING` | Provider accepts message | `NOTIFIED` | Idempotency key is marked `SENT` |
| `NOTIFYING` | Retryable provider failure | `NOTIFYING` | Attempt count and next retry time increase |
| `NOTIFYING` | Permanent or exhausted failure | `FAILED` or `PENDING` | Policy determines whether to retry on a future restock |
| `PENDING` | Customer removes subscription | `CANCELLED` | Dispatcher must not claim it |
| `NOTIFIED` | Customer subscribes again after a later stockout | New `PENDING` row | Historical notification remains auditable |

State transitions are guarded in SQL. For example, the claiming operation must update only rows where `state = 'PENDING'`; a worker must update to `NOTIFIED` only when the notification attempt belongs to that subscription and is not already complete.

## 5. Relational Data Model

### 5.1 `backorder_subscriptions`

This table is owned by the Backorder Service.

```sql
CREATE TYPE backorder_subscription_state AS ENUM (
  'PENDING',
  'NOTIFYING',
  'NOTIFIED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE notification_channel AS ENUM ('PUSH', 'EMAIL', 'SMS');

CREATE TABLE backorder_subscriptions (
  id                    UUID PRIMARY KEY,
  user_id               VARCHAR(128) NOT NULL,
  product_id            VARCHAR(128) NOT NULL,
  channel_preference    notification_channel NOT NULL,
  state                 backorder_subscription_state NOT NULL DEFAULT 'PENDING',
  source                VARCHAR(32) NOT NULL DEFAULT 'CUSTOMER_APP',
  idempotency_key       VARCHAR(255) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  notifying_at          TIMESTAMPTZ,
  notified_at           TIMESTAMPTZ,
  last_error_code       VARCHAR(128),
  last_error_message    VARCHAR(512),
  version               BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT backorder_subscription_idempotency_uq UNIQUE (idempotency_key)
);

CREATE UNIQUE INDEX backorder_active_subscription_uq
  ON backorder_subscriptions(user_id, product_id, channel_preference)
  WHERE state IN ('PENDING', 'NOTIFYING');

CREATE INDEX backorder_pending_product_idx
  ON backorder_subscriptions(product_id, id)
  WHERE state = 'PENDING';

CREATE INDEX backorder_user_created_idx
  ON backorder_subscriptions(user_id, created_at DESC);
```

### 5.2 `restock_event_inbox`

This table provides event-level idempotency for the Restock Dispatcher.

```sql
CREATE TABLE restock_event_inbox (
  event_id              VARCHAR(255) PRIMARY KEY,
  event_type            VARCHAR(128) NOT NULL,
  product_id            VARCHAR(128) NOT NULL,
  quantity_added        INTEGER NOT NULL CHECK (quantity_added > 0),
  received_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at          TIMESTAMPTZ,
  status                VARCHAR(32) NOT NULL DEFAULT 'RECEIVED',
  error_message         VARCHAR(512)
);

CREATE INDEX restock_event_product_time_idx
  ON restock_event_inbox(product_id, received_at DESC);
```

### 5.3 `notification_attempts`

This table is the source of truth for notification idempotency and delivery status.

```sql
CREATE TABLE notification_attempts (
  id                    UUID PRIMARY KEY,
  subscription_id       UUID NOT NULL REFERENCES backorder_subscriptions(id),
  source_event_id       VARCHAR(255) NOT NULL,
  channel               notification_channel NOT NULL,
  idempotency_key       VARCHAR(512) NOT NULL,
  state                 VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
  payload               JSONB NOT NULL,
  attempt_count         INTEGER NOT NULL DEFAULT 0,
  next_attempt_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_message_id   VARCHAR(255),
  last_error_code       VARCHAR(128),
  last_error_message    VARCHAR(512),
  queued_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at               TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_attempt_idempotency_uq UNIQUE (idempotency_key)
);

CREATE INDEX notification_queue_scan_idx
  ON notification_attempts(channel, state, next_attempt_at);

CREATE INDEX notification_subscription_idx
  ON notification_attempts(subscription_id, created_at DESC);
```

### 5.4 `backorder_outbox`

The outbox connects database state changes to Redis queue publication without a dual-write gap.

```sql
CREATE TABLE backorder_outbox (
  id                    BIGSERIAL PRIMARY KEY,
  aggregate_type        VARCHAR(64) NOT NULL,
  aggregate_id          UUID NOT NULL,
  event_type            VARCHAR(128) NOT NULL,
  dedupe_key            VARCHAR(512) NOT NULL UNIQUE,
  payload               JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at          TIMESTAMPTZ
);

CREATE INDEX backorder_outbox_unpublished_idx
  ON backorder_outbox(created_at)
  WHERE published_at IS NULL;
```

## 6. API Contract

### Register a Subscription

`POST /v1/backorder-subscriptions`

The endpoint requires an authenticated user context. The request body includes `product_id` and `channel_preference`; `user_id` should be derived from the access token rather than trusted from arbitrary client input in production. The user-facing contract may still expose the field in an internal command object for consistency with the integration example.

| Response | Meaning |
|---|---|
| `201 Created` | New `PENDING` subscription created |
| `200 OK` | Idempotent replay or existing active subscription returned |
| `400 Bad Request` | Product or channel is invalid |
| `409 Conflict` | An active subscription already exists for the same user, product, and channel |
| `422 Unprocessable Entity` | Product is currently available or notification channel is not reachable |
| `429 Too Many Requests` | Registration rate limit exceeded |

### Cancel a Subscription

`DELETE /v1/backorder-subscriptions/{subscription_id}`

Cancellation is idempotent. A `PENDING` subscription becomes `CANCELLED`. A `NOTIFYING` subscription is marked cancelled for future sends, while an already accepted provider send is retained in the audit log.

## 7. Thundering-Herd Mitigation

A popular restock can match thousands or millions of subscriptions. The dispatcher must not load every row into memory or enqueue an unbounded burst of provider calls.

| Control | Design |
|---|---|
| Bounded database batches | Claim at most a fixed batch size, such as 500 rows, using `FOR UPDATE SKIP LOCKED` |
| Per-product work partition | Partition or schedule dispatch by `product_id` so one popular product cannot block unrelated restocks |
| Queue back-pressure | Limit worker concurrency per channel and pause producers when Redis stream lag exceeds a threshold |
| Token-bucket provider limits | Apply channel/provider rate limits before sending; keep unsent jobs queued |
| Randomized delivery jitter | Add a bounded delay, such as 0–60 seconds, to spread sends while honoring the product’s notification SLA |
| Digest or cohort mode | For very large audiences, offer a configurable digest window or send one campaign through a provider bulk API |
| Fair scheduling | Use weighted round-robin across products so a large restock audience does not starve smaller queues |
| Retry jitter | Randomize retry delays to prevent synchronized retry storms after a provider outage |
| Cache product metadata | Resolve product name and image once per restock event and reuse it in jobs |
| Observability guardrails | Alert on queue depth, consumer lag, oldest pending job, provider rejection rate, and `NOTIFYING` timeout |

The state claim itself is the primary herd-control mechanism: a subscription leaves `PENDING` exactly once for a given restock event. The queue and provider controls then regulate how quickly the claimed population is delivered.

## 8. Idempotency and Failure Handling

The pipeline has three distinct deduplication layers. The API uses the client-provided idempotency key to make subscription creation safe across request retries. The dispatcher uses `event_id` in `restock_event_inbox` to make `ItemRestocked` handling safe across broker redelivery. The notification worker uses `subscription_id + source_event_id + channel` as the durable notification idempotency key to prevent duplicate sends.

If a worker crashes after provider acceptance but before the database update, a retry may still occur. To close this ambiguity, provider adapters should pass the same idempotency key to providers that support it. For providers that do not, the system should record the ambiguity, reconcile provider delivery receipts where available, and use a conservative retry policy.

A scheduled recovery job scans `NOTIFYING` subscriptions whose `notifying_at` exceeds the processing timeout. It reconciles any matching notification attempt, returns recoverable work to `PENDING`, or moves it to `FAILED` with an operational alert. Recovery is deterministic and safe to run repeatedly.

## 9. Security and Privacy

The API derives `user_id` from authenticated identity and authorizes reads and cancellations against that identity. Channel destinations are resolved server-side from verified customer contact data. Payment data is out of scope for this feature. Logs must redact email addresses, phone numbers, push tokens, and message bodies while retaining subscription ID, product ID, event ID, and correlation ID for troubleshooting.

## 10. Metrics and Acceptance Criteria

The implementation is ready for production integration when the system can demonstrate: duplicate registration retries return one subscription; duplicate `ItemRestocked` deliveries do not create duplicate notification attempts; every claimed subscription produces at most one idempotent job per channel and event; a provider retry does not generate duplicate sends when provider idempotency is supported; a popular restock remains within configured provider rate limits; and stuck `NOTIFYING` rows are recovered automatically.

Recommended metrics include subscription-registration success rate, active subscriptions by product and channel, restock event processing latency, rows claimed per batch, Redis queue depth, oldest queue age, notification provider acceptance rate, duplicate-event suppression count, idempotency-conflict count, `NOTIFYING` timeout count, and notification completion latency.
