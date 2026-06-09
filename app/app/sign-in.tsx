import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../lib/session";
import { ApiError } from "../lib/api";
import { Button, TextField } from "../components/ui";

export default function SignIn() {
  const { signIn, register } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setBusy(true);
    try {
      if (isRegister) {
        await register(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      // On success the root navigator's guard swaps us into the tabs.
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-center px-6"
      >
        <View className="mb-10">
          <Text className="text-4xl font-extrabold tracking-tight text-[#E7ECF2]">
            Cadance
          </Text>
          <Text className="mt-2 text-base text-[#8A97A6]">
            {isRegister
              ? "Create an account to start tracking."
              : "Welcome back. Log in to keep your streak."}
          </Text>
        </View>

        <View className="gap-4">
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={isRegister ? "At least 12 characters" : "••••••••••••"}
            secureTextEntry
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          {error ? (
            <Text className="text-sm text-[#F87171]">{error}</Text>
          ) : null}

          <Button
            title={isRegister ? "Create account" : "Log in"}
            onPress={submit}
            loading={busy}
          />

          <Button
            title={
              isRegister
                ? "Have an account? Log in"
                : "New here? Create an account"
            }
            variant="ghost"
            onPress={() => {
              setError(null);
              setMode(isRegister ? "login" : "register");
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
