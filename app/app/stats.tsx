import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, type BodyWeight } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { titleCase } from "../lib/format";
import { colors } from "../lib/theme";
import { Card, EmptyState, StatTile } from "../components/ui";
import { LogWeightModal } from "../components/LogWeightModal";

export default function StatsScreen() {
  const router = useRouter();
  const statsData = useApiData(() => api.stats.get(), []);
  const recs = useApiData(() => api.recommendations.get(7), []);
  const weights = useApiData(() => api.bodyWeights.list(), []);
  const [logging, setLogging] = useState(false);

  const stats = statsData.data;
  const rec = recs.data;
  const prs = (stats?.prs ?? []).slice(0, 12);
  const muscleMax = rec
    ? Math.max(rec.target_sets_per_muscle, ...Object.values(rec.muscle_volume))
    : 0;
  const muscleRows = rec
    ? Object.entries(rec.muscle_volume)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
    : [];

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <Text className="text-3xl font-extrabold text-[#E7ECF2]">Stats</Text>
        <Pressable onPress={() => router.back()} className="p-2">
          <Ionicons name="close" size={24} color={colors.muted} />
        </Pressable>
      </View>

      {statsData.initialLoading ? (
        <EmptyState title="Crunching your numbers…" />
      ) : statsData.error ? (
        <EmptyState title="Couldn't load stats" subtitle={statsData.error} />
      ) : (
        <ScrollView
          contentContainerClassName="px-5 pb-10 gap-3"
          showsVerticalScrollIndicator={false}
        >
          {/* Headline */}
          <View className="flex-row gap-3">
            <StatTile label="Workouts" value={stats?.total_workouts ?? 0} hint="all time" accent />
            <StatTile label="Sets" value={stats?.sets_this_week ?? 0} hint="this week" />
          </View>

          {/* Bodyweight */}
          <Text className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#8A97A6]">
            Bodyweight
          </Text>
          <BodyWeightCard
            weights={weights.data ?? []}
            onLog={() => setLogging(true)}
          />

          {/* Weekly activity */}
          <Text className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#8A97A6]">
            Workouts per week
          </Text>
          <Card>
            <WeeklyBars weekly={stats?.weekly ?? []} />
          </Card>

          {/* Volume per muscle group */}
          <Text className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#8A97A6]">
            Volume per muscle · this week
          </Text>
          <Card className="gap-3">
            {muscleRows.length === 0 ? (
              <Text className="text-sm text-[#8A97A6]">
                Log a strength session to see muscle volume.
              </Text>
            ) : (
              <>
                {muscleRows.map(([muscle, sets]) => (
                  <View key={muscle}>
                    <View className="mb-1 flex-row justify-between">
                      <Text className="text-sm text-[#E7ECF2]">{titleCase(muscle)}</Text>
                      <Text className="text-sm text-[#8A97A6]">{sets} sets</Text>
                    </View>
                    <View className="h-2 overflow-hidden rounded-full bg-[#22241D]">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((sets / Math.max(1, muscleMax)) * 100)}%`,
                          backgroundColor: colors.accent,
                        }}
                      />
                    </View>
                  </View>
                ))}
                {rec ? (
                  <Text className="text-xs text-[#6B6F62]">
                    Target ~{rec.target_sets_per_muscle} sets / muscle / week.
                  </Text>
                ) : null}
              </>
            )}
          </Card>

          {/* Personal records */}
          <Text className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#8A97A6]">
            Personal records
          </Text>
          {prs.length === 0 ? (
            <Card>
              <Text className="text-sm text-[#8A97A6]">
                Heaviest sets show up here once you've logged some lifts.
              </Text>
            </Card>
          ) : (
            <Card>
              {prs.map((pr, i) => (
                <Pressable
                  key={pr.name}
                  onPress={() =>
                    router.push(
                      `/exercise-progress?name=${encodeURIComponent(pr.name)}`
                    )
                  }
                  className={`flex-row items-center justify-between py-2.5 ${
                    i < prs.length - 1 ? "border-b border-[#232B36]" : ""
                  }`}
                >
                  <Text className="flex-1 pr-2 text-base text-[#E7ECF2]">{pr.name}</Text>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-base font-semibold text-[#E7ECF2]">
                      {pr.weight} kg
                      <Text className="text-sm font-normal text-[#8A97A6]">
                        {" "}
                        × {pr.reps}
                      </Text>
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                </Pressable>
              ))}
            </Card>
          )}
        </ScrollView>
      )}

      <LogWeightModal
        visible={logging}
        initialWeight={weights.data?.[weights.data.length - 1]?.weight_kg}
        onSaved={() => {
          setLogging(false);
          weights.reload();
        }}
        onClose={() => setLogging(false)}
      />
    </SafeAreaView>
  );
}

/** Latest weight, change since first entry, and a small trend sparkline. */
function BodyWeightCard({
  weights,
  onLog,
}: {
  weights: BodyWeight[];
  onLog: () => void;
}) {
  if (weights.length === 0) {
    return (
      <Card className="flex-row items-center justify-between">
        <Text className="flex-1 pr-3 text-sm text-[#8A97A6]">
          No weigh-ins yet. Log your weight to track the trend.
        </Text>
        <Pressable
          onPress={onLog}
          className="rounded-full bg-[#A3E635] px-4 py-2 active:opacity-80"
        >
          <Text className="text-sm font-semibold text-[#0B0F14]">Log</Text>
        </Pressable>
      </Card>
    );
  }

  const latest = weights[weights.length - 1];
  const first = weights[0];
  const delta = latest.weight_kg - first.weight_kg;
  const recent = weights.slice(-14);
  const vals = recent.map((w) => w.weight_kg);
  const min = Math.min(...vals);
  const max = Math.max(...vals);

  return (
    <Card>
      <View className="flex-row items-start justify-between">
        <View>
          <View className="flex-row items-baseline gap-1.5">
            <Text className="text-3xl font-bold text-[#E7ECF2]">
              {latest.weight_kg}
            </Text>
            <Text className="text-sm text-[#8A97A6]">kg</Text>
          </View>
          {weights.length > 1 ? (
            <Text className="mt-0.5 text-xs text-[#8A97A6]">
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)} kg since first entry
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onLog}
          className="rounded-full bg-[#A3E635] px-4 py-2 active:opacity-80"
        >
          <Text className="text-sm font-semibold text-[#0B0F14]">Log</Text>
        </Pressable>
      </View>

      {recent.length > 1 ? (
        <View className="mt-4 flex-row items-end justify-between gap-1" style={{ height: 48 }}>
          {recent.map((w) => {
            // Scale within the visible range so small changes are legible.
            const pct =
              max > min ? ((w.weight_kg - min) / (max - min)) * 100 : 50;
            return (
              <View
                key={w.id}
                className="flex-1 rounded-sm"
                style={{
                  height: `${Math.max(8, pct)}%`,
                  backgroundColor: colors.accent,
                  opacity: 0.5,
                }}
              />
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

function WeeklyBars({
  weekly,
}: {
  weekly: { week_start: string; count: number }[];
}) {
  const max = Math.max(1, ...weekly.map((w) => w.count));
  const label = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  return (
    <View className="mt-1 flex-row items-end justify-between gap-2">
      {weekly.map((w, i) => {
        const isCurrent = i === weekly.length - 1;
        return (
          <View key={w.week_start} className="flex-1 items-center gap-1.5">
            <Text className="text-[10px] font-semibold text-[#8A97A6]">
              {w.count || ""}
            </Text>
            <View className="h-24 w-full justify-end">
              <View
                className="w-full rounded-md"
                style={{
                  height: `${Math.max(w.count > 0 ? 8 : 2, Math.round((w.count / max) * 100))}%`,
                  backgroundColor: isCurrent ? colors.accent : colors.border,
                }}
              />
            </View>
            <Text className="text-[10px] text-[#6B6F62]">{label(w.week_start)}</Text>
          </View>
        );
      })}
    </View>
  );
}
