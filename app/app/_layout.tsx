import "../global.css";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../lib/session";
import { colors } from "../lib/theme";

function RootNavigator() {
  const { user, isLoading } = useSession();

  // Hold on a splash-like screen until we know whether a session exists, so we
  // don't flash the sign-in screen at an already-authenticated user.
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session" options={{ presentation: "modal" }} />
        <Stack.Screen name="recommendations" options={{ presentation: "modal" }} />
        <Stack.Screen name="stats" options={{ presentation: "modal" }} />
        <Stack.Screen name="templates" />
        <Stack.Screen name="template-edit" options={{ presentation: "modal" }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
