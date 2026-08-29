# Project TODO

- [x] Customer shop screen with product browsing
- [x] Cart management with quantity controls and totals
- [x] Checkout screen with delivery and payment summary
- [x] Order domain types and lifecycle state machine
- [x] Event-driven local service simulator
- [x] Inventory verification and reservation flow
- [x] Payment authorization and confirmation flow
- [x] Rider dispatch and assignment flow
- [x] Delivery tracking and confirmation flow
- [x] Notification Engine timeline updates
- [x] Orders history and order detail screens
- [x] Profile and operational preferences screen
- [x] Retail-specific visual theme and app branding
- [x] Custom mobile app logo and Expo asset configuration
- [x] Deterministic tests for lifecycle transitions
- [x] TypeScript, lint, and runtime validation
- [ ] Final checkpoint and mobile preview delivery

## Backorder Notification Updates

- [x] Backorder subscription domain types and `PENDING`/`NOTIFYING`/`NOTIFIED`/`CANCELLED` states
- [x] Notify Me When Available registration flow with user, product, and channel preference
- [x] Restock dispatcher handling for idempotent `ItemRestocked` events
- [x] Channel-specific Redis queue design and local queue simulation
- [x] Notification idempotency keys and subscription deduplication
- [x] Thundering-herd mitigation with batching, rate limits, and jitter
- [x] Backorder data model and SQL table schemas in technical specification
- [x] Mobile out-of-stock product state and subscription action
- [x] Backorder lifecycle tests
- [ ] Updated backorder checkpoint and delivery
