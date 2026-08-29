import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  backorderStateLabel,
  buildNotificationJob,
  canTransitionBackorder,
  createItemRestockedEvent,
  notificationIdempotencyKey,
  queueForChannel,
  subscriptionIdempotencyKey,
  type BackorderQueueName,
  type BackorderSubscription,
  type ChannelPreference,
  type ItemRestockedEvent,
  type NotificationJob,
} from "@/lib/backorder-domain";

type BackorderStoreValue = {
  subscriptions: BackorderSubscription[];
  jobs: NotificationJob[];
  lastRestockEvent?: ItemRestockedEvent;
  registerSubscription: (productId: string, productName: string, channel: ChannelPreference) => BackorderSubscription;
  simulateRestock: (productId: string, quantityAdded: number) => void;
  processNotificationQueue: () => void;
  cancelSubscription: (subscriptionId: string) => void;
  queueCounts: Record<BackorderQueueName, number>;
};

const STORAGE_KEY = "retail-order-mobile-backorders";
const demoSubscription: BackorderSubscription = {
  id: "sub-demo-001",
  userId: "USER-456",
  productId: "PROD-123",
  productName: "Seasonal Citrus Box",
  channelPreference: "PUSH",
  state: "PENDING",
  createdAt: "2026-08-29T17:32:00.000Z",
};

const BackorderContext = createContext<BackorderStoreValue | null>(null);

export function BackorderProvider({ children }: { children: ReactNode }) {
  const [subscriptions, setSubscriptions] = useState<BackorderSubscription[]>([demoSubscription]);
  const [jobs, setJobs] = useState<NotificationJob[]>([]);
  const [lastRestockEvent, setLastRestockEvent] = useState<ItemRestockedEvent>();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as { subscriptions?: BackorderSubscription[]; jobs?: NotificationJob[]; lastRestockEvent?: ItemRestockedEvent };
        if (parsed.subscriptions) setSubscriptions(parsed.subscriptions);
        if (parsed.jobs) setJobs(parsed.jobs);
        if (parsed.lastRestockEvent) setLastRestockEvent(parsed.lastRestockEvent);
      } catch {
        // Keep deterministic demo state if local persistence is malformed.
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ subscriptions, jobs, lastRestockEvent })).catch(() => undefined);
  }, [jobs, lastRestockEvent, subscriptions]);

  const value = useMemo<BackorderStoreValue>(() => {
    const registerSubscription = (productId: string, productName: string, channel: ChannelPreference) => {
      const key = subscriptionIdempotencyKey("USER-456", productId, channel);
      const existing = subscriptions.find((item) => item.id === key || (item.userId === "USER-456" && item.productId === productId && item.channelPreference === channel && ["PENDING", "NOTIFYING"].includes(item.state)));
      if (existing) return existing;
      const next: BackorderSubscription = {
        id: key,
        userId: "USER-456",
        productId,
        productName,
        channelPreference: channel,
        state: "PENDING",
        createdAt: new Date().toISOString(),
      };
      setSubscriptions((current) => [next, ...current]);
      return next;
    };

    const simulateRestock = (productId: string, quantityAdded: number) => {
      const event = createItemRestockedEvent(productId, quantityAdded);
      const isDuplicate = lastRestockEvent?.eventId === event.eventId || jobs.some((job) => job.sourceEventId === event.eventId);
      if (isDuplicate) return;
      setLastRestockEvent(event);
      const matching = subscriptions.filter((subscription) => subscription.productId === productId && subscription.state === "PENDING");
      const claimedIds = new Set(matching.map((subscription) => subscription.id));
      if (claimedIds.size) {
        setSubscriptions((current) => current.map((subscription) => claimedIds.has(subscription.id) && canTransitionBackorder(subscription.state, "NOTIFYING") ? { ...subscription, state: "NOTIFYING", notifyingAt: new Date().toISOString() } : subscription));
        const createdJobs = matching.flatMap((subscription) => {
          const key = notificationIdempotencyKey(subscription.id, event.eventId, subscription.channelPreference);
          if (jobs.some((job) => job.idempotencyKey === key)) return [];
          return [buildNotificationJob(subscription, event)];
        });
        setJobs((current) => [...createdJobs, ...current]);
      }
    };

    const processNotificationQueue = () => {
      const pending = jobs.filter((job) => job.state === "QUEUED");
      if (!pending.length) return;
      const pendingIds = new Set(pending.map((job) => job.jobId));
      setJobs((current) => current.map((job) => pendingIds.has(job.jobId) ? { ...job, state: "SENT" } : job));
      const deliveredSubscriptionIds = new Set(pending.map((job) => job.subscriptionId));
      setSubscriptions((current) => current.map((subscription) => deliveredSubscriptionIds.has(subscription.id) && subscription.state === "NOTIFYING" ? { ...subscription, state: "NOTIFIED", notifiedAt: new Date().toISOString() } : subscription));
    };

    const cancelSubscription = (subscriptionId: string) => {
      setSubscriptions((current) => current.map((subscription) => subscription.id === subscriptionId && canTransitionBackorder(subscription.state, "CANCELLED") ? { ...subscription, state: "CANCELLED" } : subscription));
    };

    const queueCounts = jobs.reduce<Record<BackorderQueueName, number>>((counts, job) => {
      if (job.state === "QUEUED") counts[queueForChannel[job.channel]] += 1;
      return counts;
    }, { "notifications:push": 0, "notifications:email": 0, "notifications:sms": 0 });

    return { subscriptions, jobs, lastRestockEvent, registerSubscription, simulateRestock, processNotificationQueue, cancelSubscription, queueCounts };
  }, [jobs, lastRestockEvent, subscriptions]);

  return <BackorderContext.Provider value={value}>{children}</BackorderContext.Provider>;
}

export function useBackorderStore() {
  const value = useContext(BackorderContext);
  if (!value) throw new Error("useBackorderStore must be used inside BackorderProvider");
  return value;
}

export { backorderStateLabel };
