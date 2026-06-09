import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, ApiError } from "../lib/api";
import { todayISO } from "../lib/format";
import { colors } from "../lib/theme";
import { Button, TextField } from "./ui";

/** Small sheet to log today's bodyweight (replaces an existing entry for today). */
export function LogWeightModal({
  visible,
  initialWeight,
  onSaved,
  onClose,
}: {
  visible: boolean;
  initialWeight?: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [weight, setWeight] = useState(
    initialWeight != null ? String(initialWeight) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const kg = Number(weight);
    if (!weight.trim() || !Number.isFinite(kg) || kg <= 0) {
      setError("Enter a valid weight.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.bodyWeights.create({ date: todayISO(), weight_kg: kg });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your weight.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
        <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
          <Text className="text-2xl font-extrabold text-[#E7ECF2]">
            Log weight
          </Text>
          <Pressable onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color={colors.muted} />
          </Pressable>
        </View>
        <View className="gap-4 px-5 pt-3">
          <TextField
            label="Today's weight (kg)"
            value={weight}
            onChangeText={setWeight}
            placeholder="e.g. 82.5"
            keyboardType="numeric"
            autoFocus
          />
          {error ? <Text className="text-sm text-[#F87171]">{error}</Text> : null}
          <Button title="Save" onPress={save} loading={busy} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
