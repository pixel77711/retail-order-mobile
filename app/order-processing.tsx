import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { lifecycle, statusLabel } from "@/lib/order-domain";
import { useOrderStore, statusProgress } from "@/lib/order-store";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { serverOrderToClientOrder } from "@/lib/order-adapter";

export default function OrderProcessingScreen() {
  const { activeOrder, advanceOrder, adoptServerOrder } = useOrderStore();
  const { isAuthenticated } = useAuth();
  const advanceMutation = trpc.orders.advance.useMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAdvance = async () => {
    if (advanceMutation.isPending) return;
    setActionError(null);
    if (!isAuthenticated) {
      advanceOrder();
      return;
    }
    try {
      const serverOrder = await advanceMutation.mutateAsync({ publicId: activeOrder.displayId });
      if (serverOrder) adoptServerOrder(serverOrderToClientOrder(serverOrder, activeOrder));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The fulfillment service could not advance this order.");
    }
  };
  const nextStep = lifecycle.find((item) => item.status !== activeOrder.status && !activeOrder.events.some((event) => event.status === item.status));
  const isComplete = activeOrder.status === "DELIVERED";
  const progress = statusProgress(activeOrder.status);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5" containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View className="mb-7 flex-row items-center justify-between">
          <Pressable accessibilityRole="button" accessibilityLabel="Close order processing" onPress={() => router.replace("/(tabs)/orders" as any)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><IconSymbol name="xmark" size={21} color="#22324A" /></Pressable>
          <Text className="text-[18px] font-bold text-foreground">Order processing</Text>
          <View className="w-10" />
        </View>
        <View className="items-center rounded-[28px] bg-navy-accent px-5 py-7" style={styles.heroShadow}>
          <View className="h-16 w-16 items-center justify-center rounded-full bg-[#314761]"><IconSymbol name={isComplete ? "checkmark.circle.fill" : "cube.box.fill"} size={32} color={isComplete ? "#A9D7C5" : "#FFFFFF"} /></View>
          <Text className="mt-4 text-center text-[24px] font-bold text-white">{isComplete ? "Delivered with care" : statusLabel[activeOrder.status]}</Text>
          <Text className="mt-2 text-center text-[13px] leading-5 text-[#C7D0D8]">Order {activeOrder.displayId} · {activeOrder.lines.length} items · ${activeOrder.total.toFixed(2)}</Text>
          <View className="mt-6 h-2 w-full overflow-hidden rounded-full bg-[#40536A]"><View className="h-full rounded-full bg-[#A9D7C5]" style={{ width: `${Math.max(progress * 100, 7)}%` }} /></View>
          <Text className="mt-3 text-[12px] font-semibold text-[#A9D7C5]">{Math.round(progress * 100)}% of the fulfillment flow complete</Text>
        </View>

        <View className="mt-7 flex-row items-center justify-between"><Text className="text-[20px] font-bold text-foreground">Service timeline</Text><View className="rounded-full bg-[#FFF0ED] px-3 py-1.5"><Text className="text-[11px] font-bold text-primary">EVENT BUS</Text></View></View>
        <View className="mt-4 rounded-[24px] bg-surface p-5" style={styles.cardShadow}>
          {lifecycle.map((step, index) => {
            const completed = activeOrder.events.some((event) => event.status === step.status) || activeOrder.status === step.status;
            const current = activeOrder.status === step.status;
            return <View key={step.status} className="flex-row">
              <View className="mr-3 items-center"><View className={completed ? "h-7 w-7 items-center justify-center rounded-full bg-success" : "h-7 w-7 items-center justify-center rounded-full border-2 border-border bg-surface"}>{completed ? <IconSymbol name="checkmark.circle.fill" size={17} color="#FFFFFF" /> : <Text className="text-[11px] font-bold text-muted">{index + 1}</Text>}</View>{index < lifecycle.length - 1 && <View className={completed ? "my-1 h-9 w-0.5 bg-success" : "my-1 h-9 w-0.5 bg-border"} />}</View>
              <View className="flex-1 pb-4"><View className="flex-row items-center justify-between"><Text className={current ? "text-[14px] font-bold text-primary" : completed ? "text-[14px] font-bold text-foreground" : "text-[14px] font-semibold text-muted"}>{step.label}</Text>{current && <Text className="text-[10px] font-bold uppercase tracking-[.7px] text-primary">Current</Text>}</View><Text className="mt-1 text-[12px] text-muted">{step.service} · {step.type}</Text></View>
            </View>;
          })}
        </View>

        {!isComplete ? <>
          <View className="mt-6 rounded-[20px] border border-[#F6D9D3] bg-[#FFF8F6] px-4 py-4"><View className="flex-row items-start"><IconSymbol name="bell.fill" size={20} color="#E85D4A" /><View className="ml-3 flex-1"><Text className="text-[14px] font-bold text-foreground">Next event ready</Text><Text className="mt-1 text-[12px] leading-5 text-muted">{nextStep ? `${nextStep.service} will emit ${nextStep.type}.` : "The workflow is ready for the next service."}</Text></View></View></View>
          {actionError && <Text className="mt-3 text-center text-[12px] font-semibold text-error">{actionError}</Text>}
          <Pressable disabled={advanceMutation.isPending} onPress={handleAdvance} style={({ pressed }) => [styles.primaryButton, advanceMutation.isPending && { opacity: 0.55 }, pressed && styles.pressed]}><Text className="text-[15px] font-bold text-white">{advanceMutation.isPending ? "Updating service…" : "Run next service step"}</Text><IconSymbol name="arrow.up.right" size={18} color="#FFFFFF" /></Pressable>
        </> : <Pressable onPress={() => router.replace("/order-detail" as any)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text className="text-[15px] font-bold text-primary">View delivery details</Text><IconSymbol name="chevron.right" size={18} color="#E85D4A" /></Pressable>}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 30 },
  iconButton: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  heroShadow: { shadowColor: "#22324A", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  cardShadow: { shadowColor: "#22324A", shadowOpacity: 0.055, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  primaryButton: { height: 54, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 17, backgroundColor: "#E85D4A" },
  secondaryButton: { height: 54, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 17, borderWidth: 1, borderColor: "#F2B7AC", backgroundColor: "#FFF8F6" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
