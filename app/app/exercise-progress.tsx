import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, type ExerciseHistoryEntry } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { formatDateLabel } from "../lib/format";
import { colors } from "../lib/theme";
import { Card, EmptyState, StatTile } from "../components/ui";

/** Epley estimated one-rep max for a set. */
function est1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

interface SessionPoint {
  date: string;
  topWeight: number;
  best1RM: number;
  volume: number;
  topReps: number;
}

function toPoints(history: ExerciseHistoryEntry[]): SessionPoint[] {
  // History arrives newest-first; plot oldest→newest.
  return [...history]
    .reverse()
    .map((entry) => {
      let topWeight = 0;
      let topReps = 0;
      let best1RM = 0;
      let volume = 0;
      for (const s of entry.sets) {
        volume += s.weight_kg * s.reps;
        if (s.weight_kg > topWeight) {
          topWeight = s.weight_kg;
          topReps = s.reps;
        }
        const e = est1RM(s.weight_kg, s.reps);
        if (e > best1RM) best1RM = e;
      }
      return { date: entry.date, topWeight, topReps, best1RM, volume };
    });
}

export default function ExerciseProgress() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const names = useApiData(() => api.exercises.names(), []);
  const [selected, setSelected] = useState<string | null>(params.name ?? null);

  // Default to the first known exercise once names load.
  useEffect(() => {
    if (selected == null && names.data && names.data.length > 0) {
      setSelected(names.data[0]);
    }
  }, [names.data, selected]);

  const history = useApiData(
    () => (selected ? api.exercises.history(selected) : Promise.resolve([])),
    [selected]
  );

  const points = useMemo(() => toPoints(history.data ?? []), [history.data]);
  const bestWeight = Math.max(0, ...points.map((p) => p.topWeight));
  const best1RM = Math.max(0, ...points.map((p) => p.best1RM));

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <Text className="text-2xl font-extrabold text-[#E7ECF2]">Progress</Text>
        <Pressable onPress={() => router.back()} className="p-2">
          <Ionicons name="close" size={24} color={colors.muted} />
        </Pressable>
      </View>

      {(names.data ?? []).length === 0 ? (
        <EmptyState
          title="No exercises yet"
          subtitle="Log a strength workout to track progress."
        />
      ) : (
        <>
          {/* Exercise selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-5 gap-2 py-2"
          >
            {(names.data ?? []).map((n) => {
              const on = n === selected;
              return (
                <Pressable
                  key={n}
                  onPress={() => setSelected(n)}
                  className={`rounded-full px-3 py-1.5 ${
                    on ? "bg-[#A3E635]" : "border border-[#232B36]"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      on ? "text-[#0B0F14]" : "text-[#8A97A6]"
                    }`}
                  >
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            contentContainerClassName="px-5 pb-10 gap-3"
            showsVerticalScrollIndicator={false}
          >
            {history.initialLoading ? (
              <EmptyState title="Loading…" />
            ) : points.length === 0 ? (
              <EmptyState title="No sets logged for this exercise yet." />
            ) : (
              <>
                <View className="flex-row gap-3">
                  <StatTile label="Best set" value={`${bestWeight} kg`} accent />
                  <StatTile label="Est. 1RM" value={`${Math.round(best1RM)} kg`} />
                </View>

                <Text className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#8A97A6]">
                  Estimated 1RM over time
                </Text>
                <Card>
                  <OneRmChart points={points.slice(-12)} />
                </Card>

                <Text className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#8A97A6]">
                  Session history
                </Text>
                <Card>
                  {[...points].reverse().map((p, i, arr) => (
                    <View
                      key={`${p.date}-${i}`}
                      className={`flex-row items-center justify-between py-2.5 ${
                        i < arr.length - 1 ? "border-b border-[#232B36]" : ""
                      }`}
                    >
                      <Text className="text-sm text-[#8A97A6]">
                        {formatDateLabel(p.date)}
                      </Text>
                      <Text className="text-base font-semibold text-[#E7ECF2]">
                        {p.topWeight} kg
                        <Text className="text-sm font-normal text-[#8A97A6]">
                          {" "}
                          × {p.topReps}
                        </Text>
                      </Text>
                    </View>
                  ))}
                </Card>
              </>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

function OneRmChart({ points }: { points: SessionPoint[] }) {
  if (points.length < 2) {
    return (
      <Text className="text-sm text-[#8A97A6]">
        Log this exercise a few more times to see a trend.
      </Text>
    );
  }
  const vals = points.map((p) => p.best1RM);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return (
    <View className="mt-1 flex-row items-end justify-between gap-1.5" style={{ height: 120 }}>
      {points.map((p, i) => {
        // Scale within the visible range so gains read clearly; latest highlighted.
        const pct = max > min ? ((p.best1RM - min) / (max - min)) * 100 : 50;
        const isLast = i === points.length - 1;
        return (
          <View key={`${p.date}-${i}`} className="flex-1 items-center gap-1.5 justify-end">
            <Text className="text-[10px] font-semibold text-[#8A97A6]">
              {Math.round(p.best1RM)}
            </Text>
            <View
              className="w-full rounded-md"
              style={{
                height: `${Math.max(8, pct)}%`,
                backgroundColor: isLast ? colors.accent : colors.border,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}
