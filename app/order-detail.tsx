import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { money, statusLabel } from "@/lib/order-domain";
import { useOrderStore } from "@/lib/order-store";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { serverOrderToClientOrder } from "@/lib/order-adapter";

export default function OrderDetailScreen() {
  const { activeOrder, confirmDelivery, advanceOrder, adoptServerOrder } = useOrderStore();
  const { isAuthenticated } = useAuth();
  const advanceMutation = trpc.orders.advance.useMutation();
  const confirmMutation = trpc.orders.confirmDelivery.useMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const delivered = activeOrder.status === "DELIVERED";

  const handleAdvance = async () => {
    setActionError(null);
    if (!isAuthenticated) {
      advanceOrder();
      return;
    }
    try {
      const serverOrder = await advanceMutation.mutateAsync({ publicId: activeOrder.displayId });
      if (serverOrder) adoptServerOrder(serverOrderToClientOrder(serverOrder, activeOrder));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The dispatch service could not update this order.");
    }
  };

  const handleConfirmDelivery = async () => {
    setActionError(null);
    if (!isAuthenticated) {
      confirmDelivery();
      return;
    }
    try {
      const serverOrder = await confirmMutation.mutateAsync({ publicId: activeOrder.displayId });
      if (serverOrder) adoptServerOrder(serverOrderToClientOrder(serverOrder, activeOrder));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The delivery confirmation could not be saved.");
    }
  };
  const rider = activeOrder.rider;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5" containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View className="mb-6 flex-row items-center justify-between">
          <Pressable accessibilityRole="button" accessibilityLabel="Back to orders" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={22} color="#22324A" /></Pressable>
          <Text className="text-[18px] font-bold text-foreground">Track order</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="View order processing" onPress={() => router.push("/order-processing" as any)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><IconSymbol name="arrow.up.right" size={19} color="#22324A" /></Pressable>
        </View>
        <View className="flex-row items-start justify-between"><View><Text className="text-[12px] font-bold uppercase tracking-[1.2px] text-primary">{activeOrder.displayId}</Text><Text className="mt-1 text-[28px] font-bold tracking-[-0.6px] text-foreground">{delivered ? "Delivered" : "On the way"}</Text><Text className="mt-1 text-[14px] text-muted">{delivered ? "Your order arrived safely." : "Your rider is heading your way."}</Text></View><View className={delivered ? "rounded-full bg-[#EAF5EE] px-3 py-2" : "rounded-full bg-[#FFF0ED] px-3 py-2"}><Text className={delivered ? "text-[12px] font-bold text-success" : "text-[12px] font-bold text-primary"}>{statusLabel[activeOrder.status]}</Text></View></View>

        <View className="mt-7 overflow-hidden rounded-[25px] bg-[#EAF5EE] p-5" style={styles.cardShadow}>
          <View className="flex-row items-center justify-between"><View><Text className="text-[12px] font-bold uppercase tracking-[1px] text-[#217A5D]">Delivery window</Text><Text className="mt-2 text-[25px] font-bold text-[#174E3D]">{delivered ? "Delivered now" : rider?.eta ?? "Assigning rider"}</Text><Text className="mt-1 text-[13px] text-[#4C796A]">{delivered ? "Leave a rating when you’re ready." : "Estimated arrival at your door"}</Text></View><Text className="text-[43px]">{delivered ? "✓" : "🚲"}</Text></View>
          <View className="mt-5 h-2 overflow-hidden rounded-full bg-[#CBE3D6]"><View className="h-full rounded-full bg-[#1F9D72]" style={{ width: delivered ? "100%" : "78%" }} /></View>
          <View className="mt-2 flex-row justify-between"><Text className="text-[11px] font-semibold text-[#4C796A]">Packed</Text><Text className="text-[11px] font-semibold text-[#4C796A]">On the way</Text><Text className="text-[11px] font-semibold text-[#4C796A]">At your door</Text></View>
        </View>

        {rider && <View className="mt-5 rounded-[23px] bg-surface p-4" style={styles.cardShadow}><View className="flex-row items-center"><View className="h-12 w-12 items-center justify-center rounded-full bg-[#22324A]"><Text className="text-[14px] font-bold text-white">{rider.initials}</Text></View><View className="ml-3 flex-1"><Text className="text-[15px] font-bold text-foreground">{rider.name}</Text><Text className="mt-1 text-[12px] text-muted">{rider.vehicle} · Your delivery partner</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Call ${rider.name}`} onPress={() => undefined} style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}><Text className="text-[12px] font-bold text-primary">Call</Text></Pressable></View></View>}

        <View className="mt-6 flex-row items-center justify-between"><Text className="text-[20px] font-bold text-foreground">Activity</Text><Text className="text-[12px] font-semibold text-muted">{activeOrder.events.length} events</Text></View>
        <View className="mt-3 rounded-[23px] bg-surface p-5" style={styles.cardShadow}>
          {activeOrder.events.map((event, index) => <View key={event.id} className="flex-row"><View className="mr-3 items-center"><View className={index === 0 ? "h-8 w-8 items-center justify-center rounded-full bg-primary" : "h-8 w-8 items-center justify-center rounded-full bg-[#EAF5EE]"}><IconSymbol name={event.status === "OUT_FOR_DELIVERY" ? "bicycle" : event.status === "DELIVERED" ? "checkmark.circle.fill" : "cube.box.fill"} size={17} color={index === 0 ? "#FFFFFF" : "#1F9D72"} /></View>{index < activeOrder.events.length - 1 && <View className="my-1 h-10 w-0.5 bg-border" />}</View><View className="flex-1 pb-4"><Text className="text-[14px] font-bold text-foreground">{event.type}</Text><Text className="mt-1 text-[12px] leading-5 text-muted">{event.message}</Text><Text className="mt-1 text-[10px] font-semibold uppercase tracking-[.5px] text-muted">{event.service}</Text></View></View>)}
        </View>

        <View className="mt-6 rounded-[23px] bg-surface p-5" style={styles.cardShadow}><Text className="mb-4 text-[17px] font-bold text-foreground">Order summary</Text>{activeOrder.lines.map((line) => <View key={line.id} className="mb-3 flex-row justify-between"><Text className="flex-1 text-[13px] text-muted">{line.quantity} × {line.name}</Text><Text className="text-[13px] font-semibold text-foreground">{money(line.price * line.quantity)}</Text></View>)}<View className="mt-1 h-px bg-border" /><View className="mt-4 flex-row justify-between"><Text className="text-[15px] font-bold text-foreground">Total paid</Text><Text className="text-[17px] font-bold text-primary">{money(activeOrder.total)}</Text></View></View>

        {actionError && <Text className="mt-4 text-center text-[12px] font-semibold text-error">{actionError}</Text>}
        {!delivered && activeOrder.status === "OUT_FOR_DELIVERY" && <Pressable disabled={confirmMutation.isPending} onPress={handleConfirmDelivery} style={({ pressed }) => [styles.primaryButton, (confirmMutation.isPending || advanceMutation.isPending) && { opacity: 0.55 }, pressed && styles.pressed]}><Text className="text-[15px] font-bold text-white">{confirmMutation.isPending ? "Saving delivery…" : "Confirm delivery"}</Text><IconSymbol name="checkmark.circle.fill" size={19} color="#FFFFFF" /></Pressable>}
        {!delivered && activeOrder.status !== "OUT_FOR_DELIVERY" && <Pressable disabled={advanceMutation.isPending} onPress={handleAdvance} style={({ pressed }) => [styles.primaryButton, advanceMutation.isPending && { opacity: 0.55 }, pressed && styles.pressed]}><Text className="text-[15px] font-bold text-white">{advanceMutation.isPending ? "Updating dispatch…" : "Advance dispatch step"}</Text><IconSymbol name="arrow.up.right" size={18} color="#FFFFFF" /></Pressable>}
        {delivered && <View className="mt-6 items-center rounded-[22px] border border-[#BEE3D1] bg-[#F1FAF5] px-4 py-4"><Text className="text-[14px] font-bold text-success">Delivery confirmed</Text><Text className="mt-1 text-center text-[12px] text-[#4C796A]">Notification Engine recorded the completion event for your order.</Text></View>}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 32 },
  iconButton: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  callButton: { borderRadius: 11, backgroundColor: "#FFF0ED", paddingHorizontal: 13, paddingVertical: 8 },
  primaryButton: { height: 54, marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 17, backgroundColor: "#E85D4A" },
  cardShadow: { shadowColor: "#22324A", shadowOpacity: 0.055, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
