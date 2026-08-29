export type ChannelPreference = "PUSH" | "EMAIL" | "SMS";

export type BackorderState = "PENDING" | "NOTIFYING" | "NOTIFIED" | "FAILED" | "CANCELLED";

export type BackorderSubscription = {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  channelPreference: ChannelPreference;
  state: BackorderState;
  createdAt: string;
  notifyingAt?: string;
  notifiedAt?: string;
  lastError?: string;
};

export type ItemRestockedEvent = {
  eventId: string;
  eventType: "ItemRestocked";
  eventVersion: 1;
  occurredAt: string;
  productId: string;
  warehouseId: string;
  quantityAdded: number;
  availableQuantity: number;
  correlationId: string;
};

export type NotificationJob = {
  jobId: string;
  idempotencyKey: string;
  subscriptionId: string;
  userId: string;
  productId: string;
  channel: ChannelPreference;
  quantityAdded: number;
  sourceEventId: string;
  queuedAt: string;
  state: "QUEUED" | "SENT" | "FAILED";
};

export type BackorderQueueName = "notifications:push" | "notifications:email" | "notifications:sms";

export const queueForChannel: Record<ChannelPreference, BackorderQueueName> = {
  PUSH: "notifications:push",
  EMAIL: "notifications:email",
  SMS: "notifications:sms",
};

export const backorderStateLabel: Record<BackorderState, string> = {
  PENDING: "Waiting for stock",
  NOTIFYING: "Notification queued",
  NOTIFIED: "Customer notified",
  FAILED: "Needs attention",
  CANCELLED: "Subscription cancelled",
};

export function subscriptionIdempotencyKey(userId: string, productId: string, channel: ChannelPreference) {
  return `${userId}:${productId}:${channel}`;
}

export function notificationIdempotencyKey(subscriptionId: string, eventId: string, channel: ChannelPreference) {
  return `${subscriptionId}:${eventId}:${channel}`;
}

export function canTransitionBackorder(from: BackorderState, to: BackorderState) {
  return (from === "PENDING" && to === "NOTIFYING")
    || (from === "NOTIFYING" && (to === "NOTIFIED" || to === "FAILED" || to === "PENDING"))
    || (from === "PENDING" && to === "CANCELLED");
}

export function createItemRestockedEvent(productId: string, quantityAdded: number): ItemRestockedEvent {
  const now = new Date().toISOString();
  return {
    eventId: `evt-restock-${Date.now()}`,
    eventType: "ItemRestocked",
    eventVersion: 1,
    occurredAt: now,
    productId,
    warehouseId: "WH-07",
    quantityAdded,
    availableQuantity: quantityAdded,
    correlationId: `receipt-${Date.now()}`,
  };
}

export function buildNotificationJob(subscription: BackorderSubscription, event: ItemRestockedEvent): NotificationJob {
  return {
    jobId: `job-${Date.now()}-${subscription.id}`,
    idempotencyKey: notificationIdempotencyKey(subscription.id, event.eventId, subscription.channelPreference),
    subscriptionId: subscription.id,
    userId: subscription.userId,
    productId: event.productId,
    channel: subscription.channelPreference,
    quantityAdded: event.quantityAdded,
    sourceEventId: event.eventId,
    queuedAt: new Date().toISOString(),
    state: "QUEUED",
  };
}
