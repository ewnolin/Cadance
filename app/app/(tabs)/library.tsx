import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  api,
  MUSCLE_GROUPS,
  type LibraryTemplate,
  type MuscleGroup,
} from "../../lib/api";
import { useApiData } from "../../lib/useApi";
import { titleCase } from "../../lib/format";
import { colors } from "../../lib/theme";
import { Button, Card, EmptyState, Pill, TextField } from "../../components/ui";

export default function Library() {
  const router = useRouter();
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<LibraryTemplate | null>(null);

  const { data, error, initialLoading } = useApiData(
    () => api.library.list({ muscle: muscle ?? undefined, q: q.trim() || undefined }),
    [muscle, q]
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
      <View className="px-5 pb-1 pt-2">
        <Text className="text-3xl font-extrabold text-[#E7ECF2]">Library</Text>
        <Text className="text-sm text-[#8A97A6]">
          Workouts shared by everyone — filter by muscle, save what you like.
        </Text>
      </View>

      <View className="px-5 pt-3">
        <TextField
          value={q}
          onChangeText={setQ}
          placeholder="Search workouts…"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5 gap-2 py-3"
      >
        {MUSCLE_GROUPS.map((m) => {
          const on = m === muscle;
          return (
            <Pressable
              key={m}
              onPress={() => setMuscle(on ? null : m)}
              className={`rounded-full px-3 py-1.5 ${
                on ? "bg-[#A3E635]" : "border border-[#232B36]"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  on ? "text-[#0B0F14]" : "text-[#8A97A6]"
                }`}
              >
                {titleCase(m)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerClassName="px-5 pb-10 gap-3"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <EmptyState title="Couldn't load the library" subtitle={error} />
        ) : initialLoading ? (
          <EmptyState title="Loading…" />
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            subtitle={
              muscle || q
                ? "No shared workouts match your filters."
                : "Publish one of your templates to seed the library."
            }
          />
        ) : (
          (data ?? []).map((t) => (
            <Pressable key={t.id} onPress={() => setSelected(t)}>
              <Card>
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 pr-2 text-lg font-semibold text-[#E7ECF2]">
                    {t.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </View>
                <Text className="mt-0.5 text-xs text-[#8A97A6]">
                  by {t.author.display_name} · {t.exercises.length} exercise
                  {t.exercises.length === 1 ? "" : "s"}
                </Text>
                {t.muscles.length > 0 ? (
                  <View className="mt-3 flex-row flex-wrap gap-1.5">
                    {t.muscles.slice(0, 6).map((m) => (
                      <Pill key={m} label={titleCase(m)} color={colors.accent} />
                    ))}
                  </View>
                ) : null}
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      <LibraryDetailModal
        template={selected}
        onClose={() => setSelected(null)}
        onStart={(templateId) => {
          setSelected(null);
          router.push(`/session?templateId=${templateId}`);
        }}
      />
    </SafeAreaView>
  );
}

/** Detail sheet for a library template: shows its plan and saves a copy. */
function LibraryDetailModal({
  template,
  onClose,
  onStart,
}: {
  template: LibraryTemplate | null;
  onClose: () => void;
  onStart: (templateId: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy(thenStart: boolean) {
    if (!template) return;
    setBusy(true);
    setError(null);
    try {
      const mine = await api.library.copy(template.id);
      if (thenStart) onStart(mine.id);
      else onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't save this workout."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={template != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
        <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
          <Text className="flex-1 pr-2 text-2xl font-extrabold text-[#E7ECF2]" numberOfLines={1}>
            {template?.name ?? ""}
          </Text>
          <Pressable onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color={colors.muted} />
          </Pressable>
        </View>

        {template ? (
          <Text className="px-5 text-sm text-[#8A97A6]">
            by {template.author.display_name}
          </Text>
        ) : null}

        <ScrollView
          contentContainerClassName="px-5 pb-6 gap-2 pt-3"
          showsVerticalScrollIndicator={false}
        >
          {template?.notes ? (
            <Text className="mb-2 text-sm text-[#E7ECF2]">{template.notes}</Text>
          ) : null}
          {(template?.exercises ?? []).map((ex) => (
            <Card key={ex.id} className="flex-row items-center justify-between">
              <Text className="flex-1 pr-2 text-base text-[#E7ECF2]">{ex.name}</Text>
              <Text className="text-sm text-[#8A97A6]">
                {[
                  ex.target_sets ? `${ex.target_sets} sets` : null,
                  ex.target_reps ? `${ex.target_reps} reps` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </Text>
            </Card>
          ))}
        </ScrollView>

        <View className="gap-2 px-5 pb-4">
          {error ? <Text className="text-sm text-[#F87171]">{error}</Text> : null}
          <Button title="Save & start" onPress={() => copy(true)} loading={busy} />
          <Button
            title="Save to my templates"
            variant="ghost"
            onPress={() => copy(false)}
            disabled={busy}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
