import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthGate } from "@/src/features/auth/components/auth-gate";
import { AuthProvider } from "@/src/features/auth/hooks/use-auth";

export const unstable_settings = {
  anchor: "(parent)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AuthGate>
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(parent)" options={{ headerShown: false }} />
            <Stack.Screen name="(child)" options={{ headerShown: false }} />
          </Stack>
        </AuthGate>
      </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
