import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, WORKOUT_TYPES } from "../../lib/api";
import { useApiData } from "../../lib/useApi";
import {
  formatDuration,
  formatDateLabel,
  todayISO,
  weekdayLetter,
  titleCase,
} from "../../lib/format";
import { colors, workoutTypeColor } from "../../lib/theme";
import { Card, StatTile, EmptyState } from "../../components/ui";

export default function Dashboard() {
  const router = useRouter();
  const { data, error, initialLoading } = useApiData(
    () => api.dashboard.get(7),
    []
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-2">
          <Text className="text-sm font-medium uppercase tracking-wider text-[#8A97A6]">
            {formatDateLabel(todayISO())}
          </Text>
          <Text className="text-3xl font-extrabold text-[#E7ECF2]">Today</Text>
        </View>

        {/* Quick links */}
        <View className="mt-4 flex-row gap-3">
          <Pressable onPress={() => router.push("/recommendations")} className="flex-1">
            <Card>
              <Ionicons name="compass" size={22} color={colors.accent} />
              <Text className="mt-2 text-base font-semibold text-[#E7ECF2]">
                Train next
              </Text>
              <Text className="mt-0.5 text-xs text-[#8A97A6]">
                Weak areas & suggestions
              </Text>
            </Card>
          </Pressable>
          <Pressable onPress={() => router.push("/stats")} className="flex-1">
            <Card>
              <Ionicons name="stats-chart" size={22} color={colors.accent} />
              <Text className="mt-2 text-base font-semibold text-[#E7ECF2]">
                Stats
              </Text>
              <Text className="mt-0.5 text-xs text-[#8A97A6]">
                Volume, PRs & trends
              </Text>
            </Card>
          </Pressable>
        </View>

        {initialLoading ? (
          <EmptyState title="Loading your week…" />
        ) : error ? (
          <EmptyState title="Couldn't load dashboard" subtitle={error} />
        ) : data ? (
          <View className="mt-5 gap-4">
            {/* Streaks */}
            <View className="flex-row gap-3">
              <StreakCard
                icon="barbell"
                label="Workout streak"
                days={data.streaks.workouts}
              />
              <StreakCard
                icon="restaurant"
                label="Nutrition streak"
                days={data.streaks.nutrition}
              />
            </View>

            {/* 7-day activity chart */}
            <Card>
              <Text className="text-xs uppercase tracking-wider text-[#8A97A6]">
                Last 7 days
              </Text>
              <WeekBars daily={data.daily} />
            </Card>

            {/* Workout totals */}
            <View className="flex-row gap-3">
              <StatTile
                label="Workouts"
                value={data.workouts.total}
                hint="this week"
                accent
              />
              <StatTile
                label="Active time"
                value={formatDuration(data.workouts.total_duration_s)}
                hint="this week"
              />
            </View>

            {/* By type */}
            {data.workouts.total > 0 ? (
              <Card>
                <Text className="mb-3 text-xs uppercase tracking-wider text-[#8A97A6]">
                  By activity
                </Text>
                <View className="gap-2.5">
                  {WORKOUT_TYPES.filter(
                    (t) => data.workouts.by_type[t] > 0
                  ).map((t) => (
                    <View
                      key={t}
                      className="flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-2.5">
                        <View
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: workoutTypeColor[t] }}
                        />
                        <Text className="text-base text-[#E7ECF2]">
                          {titleCase(t)}
                        </Text>
                      </View>
                      <Text className="text-base font-semibold text-[#E7ECF2]">
                        {data.workouts.by_type[t]}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            {/* Nutrition */}
            <View className="flex-row gap-3">
              <StatTile
                label="Avg calories"
                value={
                  data.nutrition.avg_calories_per_logged_day
                    ? data.nutrition.avg_calories_per_logged_day.toLocaleString()
                    : "—"
                }
                hint={`${data.nutrition.days_logged} day${
                  data.nutrition.days_logged === 1 ? "" : "s"
                } logged`}
              />
              <StatTile
                label="Protein"
                value={`${Math.round(data.nutrition.totals.protein)}g`}
                hint="this week"
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StreakCard({
  icon,
  label,
  days,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  days: number;
}) {
  return (
    <Card className="flex-1">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={16} color={colors.accent} />
        <Text className="text-xs uppercase tracking-wider text-[#8A97A6]">
          {label}
        </Text>
      </View>
      <View className="mt-1 flex-row items-baseline gap-1.5">
        <Text className="text-3xl font-bold text-[#E7ECF2]">{days}</Text>
        <Text className="text-sm text-[#8A97A6]">
          day{days === 1 ? "" : "s"}
        </Text>
      </View>
    </Card>
  );
}

function WeekBars({
  daily,
}: {
  daily: { date: string; workouts: number; calories: number }[];
}) {
  const max = Math.max(1, ...daily.map((d) => d.calories));
  return (
    <View className="mt-3 flex-row items-end justify-between gap-2">
      {daily.map((d) => {
        const heightPct = Math.round((d.calories / max) * 100);
        const active = d.workouts > 0;
        return (
          <View key={d.date} className="flex-1 items-center gap-1.5">
            <View className="h-24 w-full justify-end">
              <View
                className="w-full rounded-md"
                style={{
                  height: `${Math.max(d.calories > 0 ? 8 : 2, heightPct)}%`,
                  backgroundColor:
                    d.calories > 0 ? colors.accent : colors.border,
                }}
              />
            </View>
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: active ? colors.accent : "transparent",
              }}
            />
            <Text className="text-[10px] text-[#8A97A6]">
              {weekdayLetter(d.date)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
