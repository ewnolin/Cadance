import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  WORKOUT_FEELS,
  WORKOUT_TYPES,
  type CardioDetails,
  type Workout,
  type WorkoutFeel,
  type WorkoutInput,
  type WorkoutType,
  type YogaDetails,
} from "../lib/api";
import { todayISO, titleCase } from "../lib/format";
import { colors } from "../lib/theme";
import { Button, TextField } from "./ui";

interface DraftSet {
  reps: string;
  weight: string;
  rpe: string;
}
interface DraftExercise {
  name: string;
  catalogId: number | null;
  sets: DraftSet[];
}

const INTENSITIES = ["gentle", "moderate", "power"] as const;

/** RPE → a backend-valid value (1–10 in half steps), or null when blank/invalid. */
function normalizeRpe(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(1, Math.round(n * 2) / 2));
}

export function WorkoutForm({
  onSubmit,
  onCancel,
  initial,
  submitLabel = "Save workout",
}: {
  onSubmit: (input: WorkoutInput) => Promise<void>;
  onCancel: () => void;
  /** When set, the form is prefilled to edit this workout. */
  initial?: Workout;
  submitLabel?: string;
}) {
  const [type, setType] = useState<WorkoutType>(initial?.type ?? "strength");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [durationMin, setDurationMin] = useState(
    initial?.duration_s ? String(Math.round(initial.duration_s / 60)) : ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [feel, setFeel] = useState<WorkoutFeel | null>(initial?.feel ?? null);

  const [exercises, setExercises] = useState<DraftExercise[]>(() => {
    if (initial?.type === "strength" && initial.exercises?.length) {
      return initial.exercises.map((ex) => ({
        name: ex.name,
        catalogId: ex.catalog_id,
        sets: ex.sets.map((s) => ({
          reps: String(s.reps),
          weight: String(s.weight_kg),
          rpe: s.rpe != null ? String(s.rpe) : "",
        })),
      }));
    }
    return [{ name: "", catalogId: null, sets: [{ reps: "", weight: "", rpe: "" }] }];
  });

  const initialCardio =
    initial?.type === "run" || initial?.type === "cycle"
      ? (initial.details as CardioDetails | null)
      : null;
  const initialYoga =
    initial?.type === "yoga" ? (initial.details as YogaDetails | null) : null;

  const [distanceKm, setDistanceKm] = useState(
    initialCardio?.distance_km != null ? String(initialCardio.distance_km) : ""
  );
  const [elevationM, setElevationM] = useState(
    initialCardio?.elevation_m != null ? String(initialCardio.elevation_m) : ""
  );
  const [style, setStyle] = useState(initialYoga?.style ?? "");
  const [intensity, setIntensity] = useState<(typeof INTENSITIES)[number]>(
    initialYoga?.intensity ?? "moderate"
  );

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateExercise(i: number, patch: Partial<DraftExercise>) {
    setExercises((prev) =>
      prev.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex))
    );
  }
  function updateSet(ei: number, si: number, patch: Partial<DraftSet>) {
    setExercises((prev) =>
      prev.map((ex, idx) =>
        idx === ei
          ? {
              ...ex,
              sets: ex.sets.map((s, sIdx) =>
                sIdx === si ? { ...s, ...patch } : s
              ),
            }
          : ex
      )
    );
  }

  function buildInput(): WorkoutInput {
    const duration = durationMin.trim()
      ? Math.round(Number(durationMin) * 60)
      : undefined;
    const base = {
      date,
      duration_s: duration,
      notes: notes.trim() || undefined,
      feel: feel ?? undefined,
    };

    if (type === "strength") {
      const built = exercises
        .map((ex) => ({
          name: ex.name.trim(),
          catalog_id: ex.catalogId,
          sets: ex.sets
            .filter((s) => s.reps.trim() !== "" || s.weight.trim() !== "")
            .map((s) => {
              const rpe = normalizeRpe(s.rpe);
              return {
                reps: Math.max(0, Math.round(Number(s.reps) || 0)),
                weight_kg: Math.max(0, Number(s.weight) || 0),
                ...(rpe != null ? { rpe } : {}),
              };
            }),
        }))
        .filter((ex) => ex.name.length > 0);
      if (built.length === 0) {
        throw new Error("Add at least one named exercise.");
      }
      return { type: "strength", ...base, exercises: built };
    }

    if (type === "run" || type === "cycle") {
      const distance = Number(distanceKm);
      if (!distance || distance <= 0) {
        throw new Error("Distance (km) is required for a run or ride.");
      }
      return {
        type,
        ...base,
        details: {
          distance_km: distance,
          ...(elevationM.trim() ? { elevation_m: Number(elevationM) } : {}),
        },
      };
    }

    // yoga
    if (!style.trim()) throw new Error("A yoga style is required.");
    return { type: "yoga", ...base, details: { style: style.trim(), intensity } };
  }

  async function submit() {
    setError(null);
    let input: WorkoutInput;
    try {
      input = buildInput();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your entries.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save workout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerClassName="px-5 pb-10"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Type selector */}
      <View className="mb-4 flex-row gap-2">
        {WORKOUT_TYPES.map((t) => {
          const selected = t === type;
          return (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              className={`flex-1 items-center rounded-xl py-2.5 ${
                selected ? "bg-[#A3E635]" : "border border-[#232B36]"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  selected ? "text-[#0B0F14]" : "text-[#8A97A6]"
                }`}
              >
                {titleCase(t)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="gap-4">
        <TextField
          label="Date"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
        <TextField
          label="Duration (minutes, optional)"
          value={durationMin}
          onChangeText={setDurationMin}
          placeholder="e.g. 45"
          keyboardType="numeric"
        />

        {type === "strength" ? (
          <View className="gap-4">
            {exercises.map((ex, ei) => (
              <View
                key={ei}
                className="rounded-2xl border border-[#232B36] bg-[#0F141A] p-3"
              >
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <TextField
                      value={ex.name}
                      onChangeText={(v) => updateExercise(ei, { name: v })}
                      placeholder={`Exercise ${ei + 1} name`}
                    />
                  </View>
                  {exercises.length > 1 ? (
                    <Pressable
                      onPress={() =>
                        setExercises((prev) =>
                          prev.filter((_, idx) => idx !== ei)
                        )
                      }
                      className="p-2"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.danger}
                      />
                    </Pressable>
                  ) : null}
                </View>

                <View className="mt-3 gap-2">
                  <View className="flex-row gap-2">
                    <Text className="flex-1 text-xs uppercase text-[#8A97A6]">
                      Reps
                    </Text>
                    <Text className="flex-1 text-xs uppercase text-[#8A97A6]">
                      Weight (kg)
                    </Text>
                    <Text className="flex-1 text-xs uppercase text-[#8A97A6]">
                      RPE
                    </Text>
                    <View className="w-8" />
                  </View>
                  {ex.sets.map((s, si) => (
                    <View key={si} className="flex-row items-center gap-2">
                      <TextField
                        className="flex-1"
                        value={s.reps}
                        onChangeText={(v) => updateSet(ei, si, { reps: v })}
                        placeholder="0"
                        keyboardType="numeric"
                      />
                      <TextField
                        className="flex-1"
                        value={s.weight}
                        onChangeText={(v) => updateSet(ei, si, { weight: v })}
                        placeholder="0"
                        keyboardType="numeric"
                      />
                      <TextField
                        className="flex-1"
                        value={s.rpe}
                        onChangeText={(v) => updateSet(ei, si, { rpe: v })}
                        placeholder="–"
                        keyboardType="numeric"
                      />
                      <Pressable
                        onPress={() =>
                          updateExercise(ei, {
                            sets: ex.sets.filter((_, idx) => idx !== si),
                          })
                        }
                        disabled={ex.sets.length === 1}
                        className="w-8 items-center"
                      >
                        <Ionicons
                          name="close"
                          size={18}
                          color={
                            ex.sets.length === 1 ? colors.border : colors.muted
                          }
                        />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    onPress={() =>
                      updateExercise(ei, {
                        sets: [...ex.sets, { reps: "", weight: "", rpe: "" }],
                      })
                    }
                    className="mt-1 self-start"
                  >
                    <Text className="text-sm font-semibold text-[#A3E635]">
                      + Add set
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Button
              title="+ Add exercise"
              variant="ghost"
              onPress={() =>
                setExercises((prev) => [
                  ...prev,
                  { name: "", catalogId: null, sets: [{ reps: "", weight: "", rpe: "" }] },
                ])
              }
            />
          </View>
        ) : null}

        {type === "run" || type === "cycle" ? (
          <View className="flex-row gap-3">
            <TextField
              className="flex-1"
              label="Distance (km)"
              value={distanceKm}
              onChangeText={setDistanceKm}
              placeholder="e.g. 5"
              keyboardType="numeric"
            />
            <TextField
              className="flex-1"
              label="Elevation (m)"
              value={elevationM}
              onChangeText={setElevationM}
              placeholder="optional"
              keyboardType="numeric"
            />
          </View>
        ) : null}

        {type === "yoga" ? (
          <View className="gap-4">
            <TextField
              label="Style"
              value={style}
              onChangeText={setStyle}
              placeholder="e.g. Vinyasa"
            />
            <View>
              <Text className="mb-1.5 text-sm font-medium text-[#8A97A6]">
                Intensity
              </Text>
              <View className="flex-row gap-2">
                {INTENSITIES.map((lvl) => {
                  const selected = lvl === intensity;
                  return (
                    <Pressable
                      key={lvl}
                      onPress={() => setIntensity(lvl)}
                      className={`flex-1 items-center rounded-xl py-2.5 ${
                        selected ? "bg-[#A3E635]" : "border border-[#232B36]"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          selected ? "text-[#0B0F14]" : "text-[#8A97A6]"
                        }`}
                      >
                        {titleCase(lvl)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {/* Feel */}
        <View>
          <Text className="mb-1.5 text-sm font-medium text-[#8A97A6]">
            How did it feel? (optional)
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

        <TextField
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="How did it go?"
          multiline
        />

        {error ? <Text className="text-sm text-[#F87171]">{error}</Text> : null}

        <Button title={submitLabel} onPress={submit} loading={busy} />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </ScrollView>
  );
}
