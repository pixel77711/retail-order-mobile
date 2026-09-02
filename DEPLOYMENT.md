# Retail Order Mobile — Deployment Runbook

## Release posture

The mobile client now uses authenticated tRPC mutations for order creation, order lifecycle advancement, delivery confirmation, and backorder registration. The server owns the order and backorder state transitions and persists them in MySQL. The previous AsyncStorage flow remains only as an explicit unauthenticated preview fallback so the interface can be reviewed without signing in; it must not be treated as the production source of truth.

The release has two independently deployable parts: the Expo mobile bundle and the Node.js API. The API exposes liveness at `GET /api/health`, readiness at `GET /api/ready`, and typed business procedures under `/api/trpc`.

## Required environment configuration

| Variable | Required for | Purpose |
|---|---|---|
| `DATABASE_URL` | API production | MySQL connection string for users, orders, inventory, and notification outbox tables |
| `JWT_SECRET` | API production | Session signing and verification secret; use a high-entropy value and rotate through a controlled release |
| `VITE_APP_ID` | Authenticated API | Application identifier used by the existing authentication integration |
| `OAUTH_SERVER_URL` | Authenticated API | OAuth server endpoint |
| `OWNER_OPEN_ID` | Scheduled/admin operations | Owner identity used for administrative authorization |
| `EXPO_PUBLIC_API_BASE_URL` | Native mobile build | Public API base URL; do not point a production build at a local or preview host |
| `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` | Optional integrations | Existing provider-backed storage and language-model adapters |

Payment authorization is represented by a provider-safe payment reference such as `pm_demo_visa_4242`; raw card details are not accepted by the API. Before enabling real charges, implement a provider adapter that creates a payment intent server-side and accepts only the provider’s token or payment-method reference. Configure the WMS restock publisher and its signed webhook or broker credentials before enabling automated restock events.

## Database release procedure

1. Set `DATABASE_URL` in the managed project environment.
2. Run `pnpm drizzle-kit generate` after schema changes.
3. Review the generated SQL in `drizzle/` for additive and reversible changes.
4. Apply the reviewed SQL through the managed database migration workflow.
5. Run `pnpm check` and `pnpm test -- --run`.
6. Query `GET /api/ready`; the response must be HTTP 200 with `database: "ready"`.

The initial production schema creates `orders`, `order_events`, `inventory_items`, `backorder_subscriptions`, `restock_event_inbox`, and `notification_outbox` in addition to the existing `users` table. The `orders.idempotencyKey`, `backorder_subscriptions.idempotencyKey`, `backorder_subscriptions.activeKey`, and `notification_outbox.idempotencyKey` uniqueness constraints are part of the correctness model and must remain intact.

## Operational behavior

Order creation is authenticated and idempotent. Inventory reservation is conditional on the current inventory row and version. Order events are persisted alongside the state change. Backorder registration is deduplicated by user, product, and channel. Restock processing records event IDs in an inbox, claims only `PENDING` subscriptions, and writes channel-specific notification jobs to the outbox. Redis Streams or an equivalent managed queue should publish those outbox records to `notifications:push`, `notifications:email`, and `notifications:sms` with consumer groups, bounded concurrency, retry backoff, and dead-letter handling.

The current repository includes the outbox schema and a local service boundary. A production worker must be deployed as a separate long-running process or managed queue consumer; do not run an unbounded worker inside a request handler. Use provider idempotency keys, rate limits, jitter, and per-product batching to mitigate duplicate sends and restock thundering herds.

## Mobile release procedure

1. Set `EXPO_PUBLIC_API_BASE_URL` to the HTTPS API origin.
2. Verify the app’s portrait orientation, bundle identifier, launcher icon, and deep-link scheme.
3. Confirm login can establish a native bearer token and that authenticated `orders.create` and `backorders.register` requests return success.
4. Test the offline/preview branch separately; it is a usability fallback and must not be used for financial settlement.
5. Use the platform Publish workflow to produce the mobile build. Generate the APK or store artifact from that workflow rather than building a heavyweight native artifact inside the sandbox.

## Pre-release acceptance criteria

| Area | Acceptance test |
|---|---|
| Order placement | Retrying the same idempotency key returns one order and does not duplicate `OrderPlaced` |
| Inventory | An order cannot reserve more than the available quantity |
| Fulfillment | Only valid state transitions can be applied, and each transition has one durable event |
| Backorder | Repeated subscription requests return one active subscription |
| Restock | Redelivering the same `eventId` does not enqueue duplicate notifications |
| Notifications | A repeated job with the same idempotency key does not send twice |
| Scale | Queue workers enforce channel concurrency and provider rate limits |
| Recovery | Timed-out `NOTIFYING` work is visible for reconciliation and replay |
| Observability | Liveness, readiness, request errors, queue lag, and provider failures are monitored |

## Known integration boundaries

The repository is deployment-ready as a production application foundation and server-backed workflow, but real commerce operations still require environment-specific providers: an authenticated identity tenant, a payment processor, an inventory/WMS event source, a managed Redis-compatible queue, notification providers, and production observability. The adapter boundaries are explicit so those integrations can be added without changing customer-facing state vocabulary or idempotency semantics.
