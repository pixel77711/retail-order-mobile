# Retail Order Mobile — Interface Design Plan

## Product Intent

Retail Order Mobile is a customer-facing mobile ordering experience designed for fast, one-handed shopping and transparent order fulfillment. The app presents the order lifecycle as a sequence of clear operational states: order created, inventory verified, payment confirmed, rider assigned, out for delivery, and delivered.

The initial build uses deterministic local data and a local event simulator so the complete workflow can be demonstrated without production payment, inventory, dispatch, or notification credentials. Service boundaries and event names remain explicit in the UI and shared domain model so the simulator can later be replaced by API-backed microservices.

## Screen List

| Screen | Primary content | Required functionality |
|---|---|---|
| Home / Shop | Store greeting, search affordance, featured products, category chips, cart badge | Browse products, add an item to cart, open cart |
| Cart | Selected items, quantities, subtotal, delivery fee, total, delivery address summary | Adjust quantities, remove items, proceed to checkout |
| Checkout | Address, payment method, order summary, total, primary place-order action | Validate checkout data, submit order, start lifecycle simulation |
| Order Processing | Current lifecycle state, service responsible, event timeline, progress indicator | Observe transitions, retry a failed step in simulation, open order details |
| Order Detail / Tracking | Order number, status, rider information, delivery address, event timeline | View current state, simulate next operational step, confirm delivery |
| Orders | Active and historical orders, status pills, timestamps | Open any order, filter active/completed orders |
| Profile | Customer identity placeholder, saved address, payment preference, notification preference | View settings and operational preferences |

## Primary Navigation

The app uses a mainstream iOS-style bottom tab bar with **Shop**, **Orders**, and **Profile**. Cart is accessed through a compact top-right action from Shop and Checkout is entered from Cart. Order Processing and Order Detail are pushed screens so the user can return to the list without losing context.

## Key User Flows

### Place an Order

1. The customer opens Shop and selects a product.
2. The customer taps **Add to cart** and sees an immediate cart-count update.
3. The customer opens Cart, confirms quantity, and taps **Continue to checkout**.
4. The customer reviews delivery address, payment method, and total.
5. The customer taps **Place order**.
6. The app creates a local order with state `ORDER_CREATED`, appends an `OrderPlaced` event, and navigates to Order Processing.

### Verify Inventory and Confirm Payment

1. Order Processing displays `INVENTORY_CHECK_PENDING` while the Inventory Service simulator verifies each line item.
2. If all items are available, the order changes to `INVENTORY_RESERVED` and an `InventoryReserved` event is appended.
3. The Payment Service simulator authorizes the payment method and changes the order to `PAYMENT_CONFIRMED`.
4. A `PaymentConfirmed` event is appended and the order becomes eligible for dispatch.

### Dispatch Rider and Track Delivery

1. The Dispatch Service simulator receives an `OrderReadyForDispatch` event.
2. The order changes to `RIDER_ASSIGNMENT_PENDING`, then `RIDER_ASSIGNED` with a rider name, vehicle, and ETA.
3. The customer taps **Start delivery** to simulate the rider accepting the job; the state changes to `OUT_FOR_DELIVERY`.
4. The customer taps **Confirm delivery** after the rider reaches the destination; the state changes to `DELIVERED`.
5. The Notification Engine simulator appends customer-facing notifications for each material state transition.

## Brand and Color Choices

The visual identity uses **deep ink navy** for primary text and navigation, **delivery coral** for the main call to action, and **mint green** for successful service confirmations. The palette is intentionally high-contrast and warm enough to make operational progress feel reassuring rather than technical.

| Token | Light value | Usage |
|---|---|---|
| Primary | `#E85D4A` | Place order, add to cart, active progress |
| Background | `#F7F8FA` | Screen canvas |
| Surface | `#FFFFFF` | Cards, sheets, order summaries |
| Foreground | `#17202A` | Headings and core text |
| Muted | `#6B7280` | Supporting text and timestamps |
| Border | `#E5E7EB` | Dividers and card outlines |
| Success | `#1F9D72` | Inventory, payment, and delivery success |
| Warning | `#D9911E` | Pending or attention states |
| Error | `#C94B4B` | Failed or cancelled states |
| Navy accent | `#22324A` | Hero panels and service labels |

## Interaction and Accessibility Decisions

Primary actions use full-width rounded buttons placed within comfortable thumb reach near the lower portion of the screen. Cards use generous spacing, 16-point or larger body text where practical, clear status labels, and icon-plus-text combinations so color is never the only status signal. Press feedback uses a subtle scale and opacity change, while lifecycle completion uses a restrained success haptic on native platforms.

All screens use the shared safe-area container. Long content uses `FlatList` or a scrollable screen with stable keys. The order timeline exposes both the human-readable status and the originating service/event, allowing customers and operations users to understand what is happening without reading implementation logs.

## Domain Vocabulary

The mobile client models an `Order`, `OrderLine`, `OrderStatus`, `OrderEvent`, `RiderAssignment`, and `Notification`. The client-side simulator exposes service names—Order Service, Inventory Service, Payment Service, Dispatch Service, and Notification Engine—while keeping state transitions deterministic and idempotent.
