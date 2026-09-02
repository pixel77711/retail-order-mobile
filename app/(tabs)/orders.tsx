import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { money, statusLabel } from "@/lib/order-domain";
import { useOrderStore } from "@/lib/order-store";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { serverOrderToClientOrder } from "@/lib/order-adapter";

export default function OrdersScreen() {
  const { orders, activeOrder, replaceServerOrders } = useOrderStore();
  const { isAuthenticated } = useAuth();
  const serverOrdersQuery = trpc.orders.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: true });

  useEffect(() => {
    if (!serverOrdersQuery.data?.length) return;
    replaceServerOrders(serverOrdersQuery.data.map((order) => {
      const previous = orders.find((item) => item.displayId === order.publicId);
      return serverOrderToClientOrder(order, previous);
    }));
  }, [orders, replaceServerOrders, serverOrdersQuery.data]);

  const active = orders.filter((order) => order.status !== "DELIVERED" && order.status !== "CANCELLED");
  const completed = orders.filter((order) => order.status === "DELIVERED");

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View className="mb-7 mt-2"><Text className="text-[13px] font-semibold uppercase tracking-[1.4px] text-primary">Your activity</Text><Text className="mt-1 text-[30px] font-bold tracking-[-0.8px] text-foreground">Orders</Text><Text className="mt-2 text-[14px] text-muted">Follow every service handoff from checkout to doorstep.</Text></View>
        {active.length > 0 && <><Text className="mb-3 text-[19px] font-bold text-foreground">In progress</Text>{active.map((order) => <OrderCard key={order.id} order={order} actionLabel="Track delivery" onPress={() => router.push("/order-detail" as any)} />)}</>}
        <View className="mb-3 mt-7 flex-row items-center justify-between"><Text className="text-[19px] font-bold text-foreground">Recent orders</Text><Text className="text-[12px] font-semibold text-muted">{completed.length + (activeOrder.status === "DELIVERED" ? 0 : 0)} total</Text></View>
        {completed.length === 0 ? <View className="rounded-[22px] bg-surface px-5 py-7"><Text className="text-[14px] font-semibold text-foreground">Your completed orders will appear here.</Text><Text className="mt-2 text-[13px] leading-5 text-muted">Once a rider confirms delivery, the order is archived in this history.</Text></View> : completed.map((order) => <OrderCard key={order.id} order={order} actionLabel="View receipt" onPress={() => router.push("/order-detail" as any)} />)}
        <View className="mt-6 rounded-[22px] border border-[#DCE9F1] bg-[#F0F7FB] px-4 py-4"><View className="flex-row items-start"><IconSymbol name="bell.fill" size={19} color="#397B9D" /><View className="ml-3 flex-1"><Text className="text-[13px] font-bold text-[#245B76]">Status updates are event-driven</Text><Text className="mt-1 text-[12px] leading-5 text-[#5C7D8D]">The Notification Engine turns service events into customer-friendly updates.</Text></View></View></View>
      </ScrollView>
    </ScreenContainer>
  );
}

function OrderCard({ order, actionLabel, onPress }: { order: ReturnType<typeof useOrderStore>["orders"][number]; actionLabel: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}><View className="flex-row items-start justify-between"><View><Text className="text-[12px] font-bold uppercase tracking-[1px] text-muted">{order.displayId}</Text><Text className="mt-1 text-[16px] font-bold text-foreground">{order.lines.length} items · {money(order.total)}</Text></View><View className={order.status === "DELIVERED" ? "rounded-full bg-[#EAF5EE] px-3 py-1.5" : "rounded-full bg-[#FFF0ED] px-3 py-1.5"}><Text className={order.status === "DELIVERED" ? "text-[11px] font-bold text-success" : "text-[11px] font-bold text-primary"}>{statusLabel[order.status]}</Text></View></View><View className="mt-4 h-px bg-border" /><View className="mt-3 flex-row items-center justify-between"><Text className="text-[12px] text-muted">{order.address}</Text><View className="flex-row items-center"><Text className="mr-1 text-[12px] font-bold text-primary">{actionLabel}</Text><IconSymbol name="chevron.right" size={16} color="#E85D4A" /></View></View></Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 34 },
  orderCard: { marginBottom: 12, borderRadius: 22, backgroundColor: "#FFFFFF", padding: 16, shadowColor: "#22324A", shadowOpacity: 0.055, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
