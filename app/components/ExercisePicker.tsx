import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  api,
  MUSCLE_GROUPS,
  type CatalogEntry,
  type MuscleGroup,
} from "../lib/api";
import { ApiError } from "../lib/api";
import { titleCase } from "../lib/format";
import { colors } from "../lib/theme";
import { EmptyState, TextField } from "./ui";

/**
 * Modal that searches the shared exercise catalog (by name + muscle group) and
 * returns the picked exercise. Also offers an "add as custom" row so a session
 * isn't limited to catalog entries — picks a free-text name with no catalog id.
 */
export function ExercisePicker({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  onPick: (name: string, catalogId: number | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [results, setResults] = useState<CatalogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reset the query each time the picker opens.
  useEffect(() => {
    if (visible) {
      setQ("");
      setMuscle(null);
    }
  }, [visible]);

  // Debounced catalog search whenever the query or muscle filter changes.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    const handle = setTimeout(() => {
      api.exercises
        .catalog({ q: q.trim() || undefined, muscle: muscle ?? undefined })
        .then((r) => active && (setResults(r), setError(null)))
        .catch(
          (e) =>
            active &&
            setError(e instanceof ApiError ? e.message : "Search failed.")
        );
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [q, muscle, visible]);

  const trimmed = q.trim();

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
            Add exercise
          </Text>
          <Pressable onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color={colors.muted} />
          </Pressable>
        </View>

        <View className="px-5">
          <TextField
            value={q}
            onChangeText={setQ}
            placeholder="Search exercises…"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Muscle filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-5 gap-2 py-3"
        >
          {MUSCLE_GROUPS.map((m) => {
            const selected = m === muscle;
            return (
              <Pressable
                key={m}
                onPress={() => setMuscle(selected ? null : m)}
                className={`rounded-full px-3 py-1.5 ${
                  selected ? "bg-[#A3E635]" : "border border-[#232B36]"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    selected ? "text-[#0B0F14]" : "text-[#8A97A6]"
                  }`}
                >
                  {titleCase(m)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          contentContainerClassName="px-5 pb-10 gap-2"
          keyboardShouldPersistTaps="handled"
        >
          {/* Free-text "add as custom" shortcut. */}
          {trimmed ? (
            <Pressable
              onPress={() => onPick(trimmed, null)}
              className="flex-row items-center gap-3 rounded-2xl border border-dashed border-[#232B36] bg-[#0F141A] p-4 active:opacity-80"
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
              <Text className="text-base text-[#E7ECF2]">
                Add “{trimmed}” as a custom exercise
              </Text>
            </Pressable>
          ) : null}

          {error ? (
            <EmptyState title="Couldn't search" subtitle={error} />
          ) : results.length === 0 && !trimmed ? (
            <EmptyState title="Search the catalog" subtitle="Or filter by muscle group." />
          ) : (
            results.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => onPick(e.name, e.id)}
                className="rounded-2xl border border-[#232B36] bg-[#151B23] p-4 active:opacity-80"
              >
                <Text className="text-base font-semibold text-[#E7ECF2]">
                  {e.name}
                </Text>
                <Text className="mt-0.5 text-xs text-[#8A97A6]">
                  {e.primary_muscles.map(titleCase).join(", ")}
                  {e.equipment !== "other" ? ` · ${titleCase(e.equipment)}` : ""}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
