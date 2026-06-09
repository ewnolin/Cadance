import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  api,
  ApiError,
  WORKOUT_FEELS,
  type WorkoutFeel,
  type WorkoutTemplate,
} from "../lib/api";
import { todayISO, titleCase } from "../lib/format";
import { colors } from "../lib/theme";
import { loadDraft, saveDraft, clearDraft } from "../lib/draft";
import { Button, Card, EmptyState, TextField } from "../components/ui";
import { ExercisePicker } from "../components/ExercisePicker";

interface SessionSet {
  weight: string;
  reps: string;
  rpe: string;
}
interface SessionExercise {
  key: string;
  name: string;
  catalogId: number | null;
  targetReps: string | null;
  sets: SessionSet[];
}

let keySeq = 0;
const nextKey = () => `ex-${keySeq++}`;
const emptySet = (): SessionSet => ({ weight: "", reps: "", rpe: "" });

/** Seed session exercises from a template's prescription. */
function exercisesFromTemplate(t: WorkoutTemplate): SessionExercise[] {
  return t.exercises.map((ex) => ({
    key: nextKey(),
    name: ex.name,
    catalogId: ex.catalog_id,
    targetReps: ex.target_reps,
    sets: Array.from({ length: Math.max(1, ex.target_sets ?? 1) }, emptySet),
  }));
}

/** RPE → a backend-valid value (1–10 in half steps), or null when blank/invalid. */
function normalizeRpe(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(1, Math.round(n * 2) / 2));
}

export default function Session() {
  const router = useRouter();
  const params = useLocalSearchParams<{ templateId?: string }>();
  const templateId = params.templateId ? Number(params.templateId) : null;

  // One draft per source, so a freshly copied/started library workout (new id)
  // never resumes a stale draft from a different session.
  const draftKey = `session:${templateId ?? "empty"}`;

  const [title, setTitle] = useState("Quick session");
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [feel, setFeel] = useState<WorkoutFeel | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  // Hydrate once on mount: resume a saved draft if one exists, else seed from
  // the chosen template (or start empty). A one-shot load so a focus-refresh
  // can't clobber in-progress edits.
  useEffect(() => {
    let active = true;
    (async () => {
      const draft = await loadDraft<SessionExercise>(draftKey);
      if (!active) return;
      if (draft) {
        setTitle(draft.title);
        setExercises(draft.exercises);
        setFeel((draft.feel as WorkoutFeel | null) ?? null);
        setResumed(true);
      } else if (templateId != null) {
        try {
          const t = await api.templates.get(templateId);
          if (!active) return;
          setTitle(t.name);
          setExercises(exercisesFromTemplate(t));
        } catch (e) {
          if (active)
            setError(
              e instanceof ApiError ? e.message : "Couldn't load template."
            );
        }
      }
      if (active) {
        setHydrated(true);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [draftKey, templateId]);

  // Persist the draft as it changes (debounced). An empty session leaves no
  // draft behind.
  useEffect(() => {
    if (!hydrated) return;
    const handle = setTimeout(() => {
      if (exercises.length === 0 && !feel) {
        clearDraft(draftKey);
      } else {
        saveDraft(draftKey, { title, exercises, feel });
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [hydrated, draftKey, title, exercises, feel]);

  function patchSet(ei: number, si: number, patch: Partial<SessionSet>) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === ei
          ? { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) }
          : ex
      )
    );
  }
  function addSet(ei: number) {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== ei) return ex;
        // Carry the last set's weight forward — usually the next set's start.
        const last = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { ...emptySet(), weight: last?.weight ?? "" }] };
      })
    );
  }
  function removeSet(ei: number, si: number) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === ei ? { ...ex, sets: ex.sets.filter((_, j) => j !== si) } : ex
      )
    );
  }
  function removeExercise(ei: number) {
    setExercises((prev) => prev.filter((_, i) => i !== ei));
  }
  function addExercise(name: string, catalogId: number | null) {
    setExercises((prev) => [
      ...prev,
      { key: nextKey(), name, catalogId, targetReps: null, sets: [emptySet()] },
    ]);
    setPicking(false);
  }

  // Drop the resumed draft and re-seed from the template (or empty).
  async function startFresh() {
    setResumed(false);
    await clearDraft(draftKey);
    setFeel(null);
    if (templateId != null) {
      try {
        const t = await api.templates.get(templateId);
        setTitle(t.name);
        setExercises(exercisesFromTemplate(t));
        return;
      } catch {
        // fall through to an empty session
      }
    }
    setTitle("Quick session");
    setExercises([]);
  }

  function discard() {
    const go = () => {
      clearDraft(draftKey);
      router.back();
    };
    if (exercises.length === 0) return go();
    if (Platform.OS === "web") return go();
    Alert.alert("Discard session?", "Logged sets won't be saved.", [
      { text: "Keep going", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: go },
    ]);
  }

  async function finish() {
    setError(null);
    // Keep only sets with at least a weight or reps entered, and exercises that
    // still have a completed set.
    const built = exercises
      .map((ex) => ({
        name: ex.name.trim(),
        catalog_id: ex.catalogId,
        sets: ex.sets
          .filter((s) => s.weight.trim() !== "" || s.reps.trim() !== "")
          .map((s) => {
            const rpe = normalizeRpe(s.rpe);
            return {
              reps: Math.max(0, Math.round(Number(s.reps) || 0)),
              weight_kg: Math.max(0, Number(s.weight) || 0),
              ...(rpe != null ? { rpe } : {}),
            };
          }),
      }))
      .filter((ex) => ex.name.length > 0 && ex.sets.length > 0);

    if (built.length === 0) {
      setError("Log at least one set before finishing.");
      return;
    }

    setBusy(true);
    try {
      await api.workouts.create({
        type: "strength",
        date: todayISO(),
        feel: feel ?? undefined,
        exercises: built,
      });
      await clearDraft(draftKey);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save the session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <View className="flex-1 pr-3">
          <Text className="text-xs uppercase tracking-wider text-[#8A97A6]">
            Live session
          </Text>
          <Text className="text-2xl font-extrabold text-[#E7ECF2]" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Pressable onPress={discard} className="p-2">
          <Ionicons name="close" size={24} color={colors.muted} />
        </Pressable>
      </View>

      {loading ? (
        <EmptyState title="Loading…" />
      ) : (
        <ScrollView
          contentContainerClassName="px-5 pb-10 gap-3"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {resumed ? (
            <View className="flex-row items-center gap-2 rounded-2xl border border-[#232B36] bg-[#191B16] p-3">
              <Ionicons name="time-outline" size={18} color={colors.accent} />
              <Text className="flex-1 text-sm text-[#E7ECF2]">
                Resumed your in-progress session.
              </Text>
              <Pressable onPress={startFresh} className="px-2 py-1">
                <Text className="text-xs font-semibold text-[#A3E635]">
                  Start fresh
                </Text>
              </Pressable>
              <Pressable onPress={() => setResumed(false)} className="p-1">
                <Ionicons name="close" size={16} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}

          {exercises.map((ex, ei) => (
            <Card key={ex.key}>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-semibold text-[#E7ECF2]">
                    {ex.name}
                  </Text>
                  {ex.targetReps ? (
                    <Text className="mt-0.5 text-xs text-[#8A97A6]">
                      Target: {ex.targetReps} reps
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={() => removeExercise(ei)} className="p-1">
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>

              {/* Column headers */}
              <View className="mt-3 flex-row gap-2">
                <Text className="w-6 text-xs uppercase text-[#8A97A6]">#</Text>
                <Text className="flex-1 text-xs uppercase text-[#8A97A6]">Kg</Text>
                <Text className="flex-1 text-xs uppercase text-[#8A97A6]">Reps</Text>
                <Text className="flex-1 text-xs uppercase text-[#8A97A6]">RPE</Text>
                <View className="w-7" />
              </View>

              <View className="mt-1 gap-2">
                {ex.sets.map((s, si) => (
                  <View key={si} className="flex-row items-center gap-2">
                    <Text className="w-6 text-sm font-semibold text-[#8A97A6]">
                      {si + 1}
                    </Text>
                    <TextField
                      className="flex-1"
                      value={s.weight}
                      onChangeText={(v) => patchSet(ei, si, { weight: v })}
                      placeholder="–"
                      keyboardType="numeric"
                    />
                    <TextField
                      className="flex-1"
                      value={s.reps}
                      onChangeText={(v) => patchSet(ei, si, { reps: v })}
                      placeholder="–"
                      keyboardType="numeric"
                    />
                    <TextField
                      className="flex-1"
                      value={s.rpe}
                      onChangeText={(v) => patchSet(ei, si, { rpe: v })}
                      placeholder="–"
                      keyboardType="numeric"
                    />
                    <Pressable
                      onPress={() => removeSet(ei, si)}
                      disabled={ex.sets.length === 1}
                      className="w-7 items-center"
                    >
                      <Ionicons
                        name="close"
                        size={18}
                        color={ex.sets.length === 1 ? colors.border : colors.muted}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>

              <Pressable onPress={() => addSet(ei)} className="mt-2 self-start">
                <Text className="text-sm font-semibold text-[#A3E635]">+ Add set</Text>
              </Pressable>
            </Card>
          ))}

          {exercises.length === 0 ? (
            <EmptyState
              title="No exercises yet"
              subtitle="Add one to start logging."
            />
          ) : null}

          <Button
            title="+ Add exercise"
            variant="ghost"
            onPress={() => setPicking(true)}
          />

          {/* Session feel */}
          <View className="mt-2">
            <Text className="mb-1.5 text-sm font-medium text-[#8A97A6]">
              How did it feel?
            </Text>
            <View className="flex-row gap-2">
              {WORKOUT_FEELS.map((f) => {
                const selected = f === feel;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFeel(selected ? null : f)}
                    className={`flex-1 items-center rounded-xl py-2.5 ${
                      selected ? "bg-[#A3E635]" : "border border-[#232B36]"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        selected ? "text-[#0B0F14]" : "text-[#8A97A6]"
                      }`}
                    >
                      {titleCase(f)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {error ? <Text className="text-sm text-[#F87171]">{error}</Text> : null}

          <Button title="Finish & save" onPress={finish} loading={busy} />
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
