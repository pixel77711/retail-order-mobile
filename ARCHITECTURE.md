# Retail Order Mobile — End-to-End Architecture

## 1. Purpose and Scope

Retail Order Mobile is a customer-facing Expo application backed initially by a deterministic local event simulator. The simulator preserves the production service vocabulary and lifecycle so the client can demonstrate the complete order flow without requiring external payment, inventory, dispatch, or notification credentials.

The target production topology is an API gateway in front of independently deployable microservices. Each service owns its transactional data, emits integration events through a durable event bus, and exposes read models optimized for its primary access patterns. The mobile client consumes an order projection rather than joining service databases directly.

## 2. Logical Component View

| Component | Responsibility | Primary interface | Source of truth | Performance and reliability notes |
|---|---|---|---|---|
| Customer Mobile App | Browsing, cart, checkout, order tracking, customer-facing status | HTTPS API, push notification token | Local UI state plus server order projection | Uses optimistic UI only for cart actions; server remains authoritative for order state |
| API Gateway / BFF | Authentication boundary, request shaping, rate limiting, mobile-specific aggregation | REST or typed RPC | None | Stateless replicas, request correlation IDs, per-customer throttling |
| Order Service | Creates orders, owns canonical order status, records lifecycle history, exposes order projection | `POST /orders`, `GET /orders/:id` | PostgreSQL `orders` schema | Strong consistency for order writes; idempotency key on placement |
| Inventory Service | Verifies availability, reserves stock, releases reservations on cancellation | `InventoryCheckRequested`, `InventoryReserved` | PostgreSQL inventory ledger plus Redis availability cache | Short reservation TTL; atomic decrement or serializable transaction per SKU |
| Payment Service | Creates payment intent, handles provider authorization and asynchronous confirmation | Provider API plus `PaymentConfirmed` webhook | PostgreSQL payment records | Webhook signature verification, idempotent provider event handling, no card data in order DB |
| Dispatch Service | Selects rider, creates delivery task, tracks acceptance and location milestones | `OrderReadyForDispatch`, dispatch command API | PostgreSQL dispatch records plus Redis geo index | Partition by delivery zone; bounded retry for rider assignment |
| Notification Engine | Converts domain events into customer notifications and in-app activity | Event bus consumer, push provider | PostgreSQL notification log | At-least-once consumption with deduplication by event ID |
| Event Bus | Decouples service transitions and supports replay | Topics and consumer groups | Durable managed broker | Partition by `orderId` to preserve per-order ordering |
| Read Model / Order Timeline | Serves fast mobile status and activity queries | Internal projection consumer | PostgreSQL read schema or document store | Append-only event projection, cache current status by order ID |

## 3. Database Selection

Each microservice owns its schema and migration history. Cross-service writes are prohibited; services exchange facts through events and commands instead of database links.

| Service | Recommended database | Why it fits | Critical indexes or structures |
|---|---|---|---|
| Order Service | PostgreSQL | Orders, money, status transitions, and customer ownership benefit from transactions, constraints, and durable history | `orders(customer_id, created_at DESC)`, unique `idempotency_key`, `order_events(order_id, occurred_at DESC)` |
| Inventory Service | PostgreSQL plus Redis | PostgreSQL protects reservation correctness; Redis accelerates availability reads and short-lived locks | Unique `(warehouse_id, sku)`, `reservations(order_id, sku)`, Redis keys `stock:{warehouse}:{sku}` with TTL |
| Payment Service | PostgreSQL | Payment attempts, provider references, and reconciliation require durable auditability | Unique `provider_event_id`, unique `order_id` for active payment intent, `payments(status, updated_at)` |
| Dispatch Service | PostgreSQL plus Redis geo index | Relational delivery tasks need audit history; geo search and rider availability need low-latency ephemeral state | `deliveries(zone, status)`, rider heartbeat keys, Redis GEO index per operating zone |
| Notification Engine | PostgreSQL | Notification delivery status and deduplication must survive consumer restarts | Unique `(event_id, channel)`, `notifications(customer_id, created_at DESC)` |
| Event Bus | Durable broker such as Kafka, Redpanda, or managed equivalent | Replay, consumer groups, ordered partitions, and back-pressure support growing transaction volume | Partition key `orderId`; retention sized for replay and audit needs |
| Mobile client | AsyncStorage for demo preferences and local cart | Local persistence is adequate for the offline-safe demo; server sync is deferred until a backend contract is supplied | One versioned JSON state document with migration guard |

## 4. Canonical Order State Machine

The Order Service owns the canonical state. Other services publish facts that authorize the next transition; the Order Service validates the transition before persisting it.

| Current state | Triggering event or command | Next state | Owner / condition |
|---|---|---|---|
| `ORDER_CREATED` | `OrderPlaced` | `INVENTORY_CHECK_PENDING` | Order Service accepts a valid placement request |
| `INVENTORY_CHECK_PENDING` | `InventoryCheckPassed` | `INVENTORY_RESERVED` | Inventory Service confirms all lines are available |
| `INVENTORY_CHECK_PENDING` | `InventoryCheckFailed` | `FAILED` or `CANCELLED` | No valid fulfillment path remains |
| `INVENTORY_RESERVED` | `PaymentAuthorizationRequested` | `PAYMENT_PENDING` | Order Service has a valid reservation |
| `PAYMENT_PENDING` | `PaymentConfirmed` | `PAYMENT_CONFIRMED` | Payment Service verifies provider confirmation |
| `PAYMENT_PENDING` | `PaymentFailed` | `FAILED` or `CANCELLED` | Retry policy is exhausted or payment is declined |
| `PAYMENT_CONFIRMED` | `OrderReadyForDispatch` | `RIDER_ASSIGNMENT_PENDING` | Payment is confirmed and reservation remains valid |
| `RIDER_ASSIGNMENT_PENDING` | `RiderAssigned` | `RIDER_ASSIGNED` | Dispatch Service finds an eligible rider |
| `RIDER_ASSIGNMENT_PENDING` | `RiderUnavailable` | `FAILED` or retry pending | Dispatch retry policy determines outcome |
| `RIDER_ASSIGNED` | `DeliveryStarted` | `OUT_FOR_DELIVERY` | Rider accepts the delivery task |
| `OUT_FOR_DELIVERY` | `DeliveryConfirmed` | `DELIVERED` | Customer or rider confirmation passes validation |
| Any nonterminal state | `OrderCancelled` | `CANCELLED` | Cancellation policy allows cancellation |

## 5. End-to-End Execution Flow

### Phase A — Order Placement

1. The customer selects products in the Customer App and taps **Place order**.
2. The app sends `POST /orders` with the cart snapshot, delivery address, payment method token, and an idempotency key.
3. The API Gateway authenticates the customer, validates the request shape, attaches a correlation ID, and forwards it to the Order Service.
4. The Order Service validates product references and prices against its accepted checkout snapshot, persists the order with state `ORDER_CREATED`, writes an `OrderPlaced` record to its outbox, and returns the order ID.
5. An outbox publisher atomically relays `OrderPlaced` to the event bus. The mobile app navigates to Order Processing and displays the event in the timeline.

Example execution statement: **The Customer App submits a cart with idempotency key `k-123`. The Order Service persists order `RO-240829-001` with state `ORDER_CREATED` and publishes `OrderPlaced` keyed by the order ID.**

### Phase B — Inventory Verification and Reservation

1. The Inventory Service consumes `OrderPlaced` from its consumer group.
2. It reads availability from its Redis cache and validates the authoritative PostgreSQL inventory ledger for each SKU.
3. If all lines are available, it creates reservation records with an expiration timestamp, decrements available-to-reserve quantities within a transaction, and emits `InventoryReserved`.
4. The Order Service consumes `InventoryReserved`, verifies the expected prior state, persists `INVENTORY_RESERVED`, and emits `PaymentAuthorizationRequested`.
5. If any line is unavailable, the Inventory Service emits `InventoryCheckFailed`. The Order Service records the failure, releases any partial reservation, and transitions the order according to the cancellation policy.

### Phase C — Payment Authorization and Confirmation

1. The Payment Service consumes `PaymentAuthorizationRequested` and creates a provider payment intent using the tokenized payment reference.
2. The provider may respond synchronously or later through a signed webhook. The Payment Service stores the provider reference and current attempt state.
3. On a valid confirmation, the Payment Service deduplicates by provider event ID, persists the attempt as confirmed, and emits `PaymentConfirmed`.
4. The Order Service consumes the event, verifies that inventory remains reserved, persists `PAYMENT_CONFIRMED`, and emits `OrderReadyForDispatch`.
5. A declined or expired authorization produces `PaymentFailed`. The Order Service either requests a retry through a supported payment method flow or transitions the order to `FAILED` and emits `InventoryReleaseRequested`.

### Phase D — Rider Dispatch

1. The Dispatch Service consumes `OrderReadyForDispatch` and creates a delivery task with state `RIDER_ASSIGNMENT_PENDING`.
2. It queries the Redis geo index for available riders in the delivery zone and validates rider capacity and heartbeat freshness.
3. The service reserves a rider assignment in PostgreSQL, emits `RiderAssigned`, and records the estimated arrival window.
4. The Order Service persists `RIDER_ASSIGNED`; the Notification Engine emits a customer update with the rider name and ETA.
5. When the rider accepts the task, Dispatch Service emits `DeliveryStarted`. The Order Service persists `OUT_FOR_DELIVERY` and the mobile tracking screen refreshes its order projection.

### Phase E — Delivery Confirmation

1. The rider or customer submits a delivery confirmation with the delivery task ID and confirmation metadata.
2. The Dispatch Service validates that the task is assigned to the rider and that the delivery is within the allowed transition window.
3. It emits `DeliveryConfirmed` with the order ID, rider ID, and confirmation timestamp.
4. The Order Service verifies that the order is `OUT_FOR_DELIVERY`, persists `DELIVERED`, and emits `OrderDelivered`.
5. The Notification Engine records and sends the completion notification. Inventory reservations are finalized, and the order becomes immutable except for post-delivery support adjustments.

## 6. Event Contract Rules

Events are immutable facts and include `eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`, `correlationId`, `causationId`, `orderId`, and a typed payload. Consumers must be idempotent because delivery is at least once. A consumer stores the processed event ID before committing its state change or uses a transactionally coupled inbox table.

| Event | Producer | Main consumers | Effect |
|---|---|---|---|
| `OrderPlaced` | Order Service | Inventory Service, Notification Engine | Start availability verification and inform customer |
| `InventoryReserved` | Inventory Service | Order Service, Notification Engine | Permit payment authorization |
| `InventoryCheckFailed` | Inventory Service | Order Service, Notification Engine | Stop fulfillment or start cancellation |
| `PaymentAuthorizationRequested` | Order Service | Payment Service | Begin payment authorization |
| `PaymentConfirmed` | Payment Service | Order Service, Notification Engine | Permit dispatch |
| `PaymentFailed` | Payment Service | Order Service, Notification Engine | Retry or fail order |
| `OrderReadyForDispatch` | Order Service | Dispatch Service | Create delivery task |
| `RiderAssigned` | Dispatch Service | Order Service, Notification Engine | Show rider and ETA |
| `DeliveryStarted` | Dispatch Service | Order Service, Notification Engine | Mark order out for delivery |
| `DeliveryConfirmed` | Dispatch Service | Order Service, Notification Engine | Complete the order |
| `OrderDelivered` | Order Service | Notification Engine, analytics | Send completion update and finalize metrics |

## 7. Reliability and Scale Controls

The mobile-facing API remains stateless and scales horizontally behind a load balancer. The event bus partitions by `orderId`, which preserves the order of a single order’s events while allowing unrelated orders to process concurrently. The Order Service uses an outbox table to prevent the dual-write problem between its database and the broker.

All commands carry idempotency keys. Consumers use inbox or deduplication records. Retries are exponential and bounded; poison messages move to a dead-letter topic with an operational replay path. Circuit breakers protect payment and dispatch provider calls. Timeouts are explicit, and every failure is observable through structured logs, metrics, and distributed traces using the correlation ID.

The most important operational SLOs are order-placement acceptance latency, time from `ORDER_CREATED` to `PAYMENT_CONFIRMED`, rider-assignment success rate, delivery completion rate, event-consumer lag, and notification delivery success. Data retention policies distinguish financial records, order history, and short-lived rider telemetry.

## 8. Mobile Implementation Mapping

The current app maps production responsibilities into a local `OrderProvider` and pure lifecycle helpers. `order-domain.ts` owns shared types, products, statuses, and event construction. `order-store.tsx` simulates service transitions, persists demo state in AsyncStorage, and updates the active order and history. The Shop, Cart, Checkout, Order Processing, Order Detail, Orders, and Profile screens expose the primary operational flows.

To connect a real backend, replace `placeOrder`, `advanceOrder`, and `confirmDelivery` with typed API calls. Keep the event and state vocabulary unchanged, subscribe to the order projection or push notification channel, and treat server state as authoritative. The client should continue to render a stable timeline even when events arrive out of order by sorting on the server-provided sequence number rather than device time.
