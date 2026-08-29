import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useOrderStore } from "@/lib/order-store";
import { backorderStateLabel } from "@/lib/backorder-domain";
import { useBackorderStore } from "@/lib/backorder-store";

const services = [
  { name: "Order Service", description: "Persists orders and owns the customer lifecycle.", icon: "bag.fill" },
  { name: "Inventory Service", description: "Verifies availability and reserves stock.", icon: "cube.box.fill" },
  { name: "Payment Service", description: "Authorizes the selected payment method.", icon: "creditcard.fill" },
  { name: "Dispatch Service", description: "Assigns the nearest rider and tracks delivery.", icon: "bicycle" },
  { name: "Notification Engine", description: "Turns events into timely status updates.", icon: "bell.fill" },
] as const;

export default function ProfileScreen() {
  const { resetDemo } = useOrderStore();
  const { subscriptions, queueCounts, lastRestockEvent, simulateRestock, processNotificationQueue } = useBackorderStore();
  const backorder = subscriptions[0];
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View className="mb-7 mt-2"><Text className="text-[13px] font-semibold uppercase tracking-[1.4px] text-primary">Account</Text><Text className="mt-1 text-[30px] font-bold tracking-[-0.8px] text-foreground">Profile</Text></View>
        <View className="flex-row items-center rounded-[23px] bg-navy-accent p-5" style={styles.heroShadow}><View className="h-14 w-14 items-center justify-center rounded-full bg-[#A9D7C5]"><Text className="text-[18px] font-bold text-[#174E3D]">AK</Text></View><View className="ml-4"><Text className="text-[18px] font-bold text-white">Alex Kim</Text><Text className="mt-1 text-[13px] text-[#C7D0D8]">alex.kim@example.com</Text></View></View>
        <Text className="mb-3 mt-8 text-[19px] font-bold text-foreground">Saved details</Text>
        <View className="rounded-[23px] bg-surface p-4" style={styles.cardShadow}><SettingRow icon="location.fill" label="Home address" value="18 Cedar Lane, Apt 4B" /><View className="my-4 h-px bg-border" /><SettingRow icon="creditcard.fill" label="Payment method" value="Visa ending 4242" /><View className="my-4 h-px bg-border" /><SettingRow icon="bell.fill" label="Order notifications" value="Enabled" /></View>
        <View className="mb-3 mt-8 flex-row items-center justify-between"><Text className="text-[19px] font-bold text-foreground">How it works</Text><View className="rounded-full bg-[#FFF0ED] px-3 py-1.5"><Text className="text-[10px] font-bold tracking-[.8px] text-primary">ARCHITECTURE</Text></View></View>
        <View className="rounded-[23px] bg-surface p-4" style={styles.cardShadow}>{services.map((service, index) => <View key={service.name} className={index < services.length - 1 ? "mb-4 flex-row items-center" : "flex-row items-center"}><View className="h-10 w-10 items-center justify-center rounded-xl bg-[#F1F3F5]"><IconSymbol name={service.icon} size={19} color="#22324A" /></View><View className="ml-3 flex-1"><Text className="text-[13px] font-bold text-foreground">{service.name}</Text><Text className="mt-1 text-[11px] leading-4 text-muted">{service.description}</Text></View></View>)}</View>
        <Text className="mb-3 mt-8 text-[19px] font-bold text-foreground">Backorder pipeline</Text>
        <View className="rounded-[23px] bg-surface p-4" style={styles.cardShadow}>
          <View className="flex-row items-start"><View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0ED]"><IconSymbol name="bell.fill" size={19} color="#E85D4A" /></View><View className="ml-3 flex-1"><Text className="text-[14px] font-bold text-foreground">{backorder?.productName ?? "Seasonal Citrus Box"}</Text><Text className="mt-1 text-[12px] leading-5 text-muted">Subscription: {backorder ? backorderStateLabel[backorder.state] : "None"}</Text></View><View className="rounded-full bg-[#EAF5EE] px-2.5 py-1.5"><Text className="text-[10px] font-bold text-success">{backorder?.channelPreference ?? "PUSH"}</Text></View></View>
          <View className="mt-4 flex-row gap-2"><QueuePill label="Push" count={queueCounts["notifications:push"]} /><QueuePill label="Email" count={queueCounts["notifications:email"]} /><QueuePill label="SMS" count={queueCounts["notifications:sms"]} /></View>
          {lastRestockEvent && <Text className="mt-3 text-[11px] leading-4 text-muted">Last event: ItemRestocked · {lastRestockEvent.quantityAdded} units added · {lastRestockEvent.productId}</Text>}
          <View className="mt-4 flex-row gap-2"><Pressable onPress={() => simulateRestock("PROD-123", 50)} style={({ pressed }) => [styles.pipelineButton, pressed && styles.pressed]}><Text className="text-[12px] font-bold text-primary">Simulate restock</Text></Pressable><Pressable onPress={processNotificationQueue} style={({ pressed }) => [styles.pipelineButtonSuccess, pressed && styles.pressed]}><Text className="text-[12px] font-bold text-success">Process queues</Text></Pressable></View>
        </View>
        <Pressable onPress={resetDemo} style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}><IconSymbol name="arrow.clockwise" size={18} color="#E85D4A" /><Text className="ml-2 text-[13px] font-bold text-primary">Reset demo order</Text></Pressable>
        <Text className="mt-5 text-center text-[11px] leading-4 text-muted">Retail Order Mobile · Event-driven fulfillment demo</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function QueuePill({ label, count }: { label: string; count: number }) {
  return <View className="flex-1 rounded-xl bg-[#F1F3F5] px-2 py-2"><Text className="text-[10px] font-semibold text-muted">{label} queue</Text><Text className="mt-1 text-[15px] font-bold text-foreground">{count} <Text className="text-[11px] font-medium text-muted">queued</Text></Text></View>;
}

function SettingRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <View className="flex-row items-center"><View className="h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0ED]"><IconSymbol name={icon} size={18} color="#E85D4A" /></View><View className="ml-3 flex-1"><Text className="text-[12px] text-muted">{label}</Text><Text className="mt-1 text-[13px] font-semibold text-foreground">{value}</Text></View><IconSymbol name="chevron.right" size={17} color="#9AA1A8" /></View>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 34 },
  heroShadow: { shadowColor: "#22324A", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  cardShadow: { shadowColor: "#22324A", shadowOpacity: 0.055, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  pipelineButton: { flex: 1, alignItems: "center", borderRadius: 12, backgroundColor: "#FFF0ED", paddingVertical: 11 },
  pipelineButtonSuccess: { flex: 1, alignItems: "center", borderRadius: 12, backgroundColor: "#EAF5EE", paddingVertical: 11 },
  resetButton: { marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 15, borderWidth: 1, borderColor: "#F2B7AC", backgroundColor: "#FFF8F6", paddingVertical: 14 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
