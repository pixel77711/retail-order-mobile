import { describe, expect, it } from "vitest";

import {
  buildNotificationJob,
  canTransitionBackorder,
  createItemRestockedEvent,
  notificationIdempotencyKey,
  queueForChannel,
  subscriptionIdempotencyKey,
  type BackorderSubscription,
} from "../lib/backorder-domain";

describe("backorder notification lifecycle", () => {
  const subscription: BackorderSubscription = {
    id: "SUB-9f2c",
    userId: "USER-456",
    productId: "PROD-123",
    productName: "Seasonal Citrus Box",
    channelPreference: "PUSH",
    state: "PENDING",
    createdAt: "2026-08-29T17:32:00.000Z",
  };

  it("supports conditional pending-to-notifying and notifying-to-notified transitions", () => {
    expect(canTransitionBackorder("PENDING", "NOTIFYING")).toBe(true);
    expect(canTransitionBackorder("NOTIFYING", "NOTIFIED")).toBe(true);
    expect(canTransitionBackorder("NOTIFIED", "NOTIFYING")).toBe(false);
    expect(canTransitionBackorder("CANCELLED", "NOTIFYING")).toBe(false);
  });

  it("routes each channel to a channel-specific queue", () => {
    expect(queueForChannel.PUSH).toBe("notifications:push");
    expect(queueForChannel.EMAIL).toBe("notifications:email");
    expect(queueForChannel.SMS).toBe("notifications:sms");
  });

  it("creates compact restock jobs with deterministic deduplication keys", () => {
    const event = createItemRestockedEvent("PROD-123", 50);
    const job = buildNotificationJob(subscription, event);
    expect(event.eventType).toBe("ItemRestocked");
    expect(event.quantityAdded).toBe(50);
    expect(job.idempotencyKey).toBe(notificationIdempotencyKey("SUB-9f2c", event.eventId, "PUSH"));
    expect(subscriptionIdempotencyKey("USER-456", "PROD-123", "PUSH")).toBe("USER-456:PROD-123:PUSH");
  });
});
