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
- [x] Final checkpoint and mobile preview delivery

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
- [x] Updated backorder checkpoint and delivery

## Deployment Readiness

- [x] Audit and document demo-only versus production-backed behavior
- [x] Define server-backed order and backorder API contracts
- [x] Add production persistence for orders, inventory reservations, and backorder subscriptions
- [x] Add idempotent order placement and backorder registration endpoints
- [x] Add secure payment-provider adapter boundary and webhook verification boundary
- [x] Add event outbox and restock-dispatch processing boundaries
- [x] Replace critical client actions with server-backed mutations
- [x] Add environment validation and deployment configuration
- [x] Add health checks, structured logging, and operational error handling
- [x] Add deployment and migration runbook
- [x] Validate production build and automated tests
- [x] Save deployment-ready checkpoint

## Error Audit and Fixes

- [x] Reproduce current TypeScript, lint, test, build, and runtime errors
- [x] Fix all reproducible code and integration errors
- [x] Verify mobile order and backorder flows after fixes
- [x] Re-run the complete validation suite
- [x] Save corrected checkpoint

## Windows Development Compatibility

- [x] Remove Unix-only environment expansion from Expo startup scripts
- [x] Add Windows-friendly Metro launcher and environment validation
- [x] Add VS Code and PowerShell setup guidance
- [x] Validate Windows-oriented scripts, TypeScript, tests, lint, and build
- [ ] Save Windows-compatible checkpoint

## Windows Dependency Installation Fix

- [x] Reproduce and inspect the `tsx`/esbuild postinstall version mismatch
- [x] Align the package and lockfile dependency versions
- [x] Verify clean Windows-oriented install and startup commands
- [ ] Save dependency-fix checkpoint

## Published Windows Dependency Fix

- [ ] Verify GitHub `main` contains the pinned esbuild version
- [ ] Publish the dependency and lockfile fix to GitHub if missing
- [ ] Verify a clean install against the published repository
- [ ] Deliver exact Windows cleanup and launch commands
