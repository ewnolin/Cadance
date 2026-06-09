import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, ApiError, type WorkoutTemplateInput } from "../lib/api";
import { colors } from "../lib/theme";
import { Button, Card, EmptyState, TextField } from "../components/ui";
import { ExercisePicker } from "../components/ExercisePicker";

interface EditorExercise {
  key: string;
  name: string;
  catalogId: number | null;
  targetSets: string;
  targetReps: string;
}

let keySeq = 0;
const nextKey = () => `te-${keySeq++}`;

export default function TemplateEdit() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : null;
  const editing = id != null;

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<EditorExercise[]>([]);
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  // Load the existing template once when editing.
  useEffect(() => {
    if (id == null) return;
    let active = true;
    api.templates
      .get(id)
      .then((t) => {
        if (!active) return;
        setName(t.name);
        setNotes(t.notes ?? "");
        setExercises(
          t.exercises.map((ex) => ({
            key: nextKey(),
            name: ex.name,
            catalogId: ex.catalog_id,
            targetSets: ex.target_sets != null ? String(ex.target_sets) : "",
            targetReps: ex.target_reps ?? "",
          }))
        );
      })
      .catch(
        (e) =>
          active &&
          setError(e instanceof ApiError ? e.message : "Couldn't load template.")
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  function patch(i: number, p: Partial<EditorExercise>) {
    setExercises((prev) => prev.map((ex, j) => (j === i ? { ...ex, ...p } : ex)));
  }
  function addExercise(exName: string, catalogId: number | null) {
    setExercises((prev) => [
      ...prev,
      { key: nextKey(), name: exName, catalogId, targetSets: "", targetReps: "" },
    ]);
    setPicking(false);
  }

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("Give your template a name.");
      return;
    }
    const built: WorkoutTemplateInput = {
      name: name.trim(),
      notes: notes.trim() || null,
      exercises: exercises
        .filter((e) => e.name.trim().length > 0)
        .map((e) => ({
          name: e.name.trim(),
          catalog_id: e.catalogId,
          target_sets: e.targetSets.trim() ? Math.max(1, Math.round(Number(e.targetSets) || 0)) : null,
          target_reps: e.targetReps.trim() || null,
        })),
    };

    setBusy(true);
    try {
      if (editing) await api.templates.update(id!, built);
      else await api.templates.create(built);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save the template.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <Text className="text-2xl font-extrabold text-[#E7ECF2]">
          {editing ? "Edit template" : "New template"}
        </Text>
        <Pressable onPress={() => router.back()} className="p-2">
          <Ionicons name="close" size={24} color={colors.muted} />
        </Pressable>
      </View>

      {loading ? (
        <EmptyState title="Loading…" />
      ) : (
        <ScrollView
          contentContainerClassName="px-5 pb-10 gap-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Push Day"
          />
          <TextField
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Focus, rest times, etc."
            multiline
          />

          <View className="gap-2">
            {exercises.map((ex, i) => (
              <Card key={ex.key}>
                <View className="flex-row items-start justify-between">
                  <Text className="flex-1 pr-2 text-base font-semibold text-[#E7ECF2]">
                    {ex.name}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setExercises((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="p-1"
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
                <View className="mt-2 flex-row gap-3">
                  <TextField
                    className="flex-1"
                    label="Sets"
                    value={ex.targetSets}
                    onChangeText={(v) => patch(i, { targetSets: v })}
                    placeholder="e.g. 4"
                    keyboardType="numeric"
                  />
                  <TextField
                    className="flex-1"
                    label="Reps"
                    value={ex.targetReps}
                    onChangeText={(v) => patch(i, { targetReps: v })}
                    placeholder="e.g. 8-12"
                  />
                </View>
              </Card>
            ))}
          </View>

          <Button
            title="+ Add exercise"
            variant="ghost"
            onPress={() => setPicking(true)}
          />

          {error ? <Text className="text-sm text-[#F87171]">{error}</Text> : null}

          <Button
            title={editing ? "Save changes" : "Create template"}
            onPress={save}
            loading={busy}
          />
        </ScrollView>
      )}

      <ExercisePicker
        visible={picking}
        onPick={addExercise}
        onClose={() => setPicking(false)}
      />
    </SafeAreaView>
  );
}
