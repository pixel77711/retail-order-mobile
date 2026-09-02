import "../global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { BackorderProvider } from "@/lib/backorder-store";
import { OrderProvider } from "@/lib/order-store";
import { createTRPCClient, trpc } from "@/lib/trpc";
import { ThemeProvider } from "@/lib/theme-provider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 2 },
    mutations: { retry: 0 },
  },
});
const trpcClient = createTRPCClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <ThemeProvider>
          <OrderProvider>
            <BackorderProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="cart" options={{ presentation: "modal" }} />
                <Stack.Screen name="checkout" options={{ presentation: "modal" }} />
                <Stack.Screen name="order-processing" />
                <Stack.Screen name="order-detail" />
              </Stack>
            </BackorderProvider>
          </OrderProvider>
        </ThemeProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
