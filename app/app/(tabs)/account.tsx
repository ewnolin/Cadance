import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../lib/session";
import { api, ApiError, API_BASE_URL } from "../../lib/api";
import { formatDateLabel } from "../../lib/format";
import { colors } from "../../lib/theme";
import { Button, Card, TextField } from "../../components/ui";

export default function Account() {
  const { user, signOut } = useSession();
  const [showPwForm, setShowPwForm] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function changePassword() {
    setError(null);
    setMsg(null);
    if (!current || !next) {
      setError("Both fields are required.");
      return;
    }
    setBusy(true);
    try {
      await api.account.changePassword(current, next);
      setMsg("Password updated.");
      setCurrent("");
      setNext("");
      setShowPwForm(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
      <ScrollView
        contentContainerClassName="px-5 pb-10 gap-4"
        showsVerticalScrollIndicator={false}
      >
        <Text className="pt-2 text-3xl font-extrabold text-[#E7ECF2]">
          Account
        </Text>

        <Card className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#A3E635]">
              <Ionicons name="person" size={22} color={colors.accentText} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-[#E7ECF2]">
                {user?.email ?? "—"}
              </Text>
              {user ? (
                <Text className="text-sm text-[#8A97A6]">
                  Member since {formatDateLabel(user.created_at.slice(0, 10))}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {msg ? <Text className="text-sm text-[#A3E635]">{msg}</Text> : null}

        {showPwForm ? (
          <Card className="gap-4">
            <Text className="text-base font-semibold text-[#E7ECF2]">
              Change password
            </Text>
            <TextField
              label="Current password"
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
            />
            <TextField
              label="New password"
              value={next}
              onChangeText={setNext}
              placeholder="At least 12 characters"
              secureTextEntry
            />
            {error ? (
              <Text className="text-sm text-[#F87171]">{error}</Text>
            ) : null}
            <Button title="Save password" onPress={changePassword} loading={busy} />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => {
                setShowPwForm(false);
                setError(null);
              }}
            />
          </Card>
        ) : (
          <Button
            title="Change password"
            variant="ghost"
            onPress={() => setShowPwForm(true)}
          />
        )}

        <Button title="Log out" variant="danger" onPress={signOut} />

        <Text className="mt-2 text-center text-xs text-[#8A97A6]">
          Connected to {API_BASE_URL}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
