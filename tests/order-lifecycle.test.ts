import { describe, expect, it } from "vitest";

import { eventForStatus, initialOrder, nextLifecycleStatus, statusLabel } from "../lib/order-domain";

// The mobile flow uses these pure transition helpers so service simulations stay testable without native APIs.
describe("retail order lifecycle", () => {
  it("starts from an out-for-delivery demo state", () => {
    expect(initialOrder.status).toBe("OUT_FOR_DELIVERY");
    expect(statusLabel[initialOrder.status]).toBe("Out for delivery");
  });

  it("progresses through the fulfillment states in order", () => {
    expect(nextLifecycleStatus("ORDER_CREATED")).toBe("INVENTORY_RESERVED");
    expect(nextLifecycleStatus("INVENTORY_RESERVED")).toBe("PAYMENT_CONFIRMED");
    expect(nextLifecycleStatus("PAYMENT_CONFIRMED")).toBe("RIDER_ASSIGNED");
    expect(nextLifecycleStatus("RIDER_ASSIGNED")).toBe("OUT_FOR_DELIVERY");
    expect(nextLifecycleStatus("OUT_FOR_DELIVERY")).toBe("DELIVERED");
    expect(nextLifecycleStatus("DELIVERED")).toBeNull();
  });

  it("creates service-owned events with the matching state", () => {
    const event = eventForStatus("PAYMENT_CONFIRMED", initialOrder);
    expect(event?.type).toBe("PaymentConfirmed");
    expect(event?.service).toBe("Payment Service");
    expect(event?.status).toBe("PAYMENT_CONFIRMED");
  });
});
