import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  api,
  ApiError,
  type SuggestedTemplate,
  type WeakArea,
} from "../lib/api";
import { useApiData } from "../lib/useApi";
import { titleCase } from "../lib/format";
import { colors } from "../lib/theme";
import { Card, EmptyState, Pill } from "../components/ui";

export default function RecommendationsScreen() {
  const router = useRouter();
  const { data, error, initialLoading } = useApiData(
    () => api.recommendations.get(7),
    []
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <View className="flex-1 pr-3">
          <Text className="text-xs uppercase tracking-wider text-[#8A97A6]">
            Last 7 days
          </Text>
          <Text className="text-3xl font-extrabold text-[#E7ECF2]">
            Train next
          </Text>
        </View>
        <Pressable onPress={() => router.back()} className="p-2">
          <Ionicons name="close" size={24} color={colors.muted} />
        </Pressable>
      </View>

      {error ? (
        <EmptyState title="Couldn't load recommendations" subtitle={error} />
      ) : initialLoading ? (
        <EmptyState title="Analyzing your week…" />
      ) : data ? (
        <ScrollView
          contentContainerClassName="px-5 pb-10 gap-3"
          showsVerticalScrollIndicator={false}
        >
          {/* Weak areas */}
          <Text className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#8A97A6]">
            Under-trained muscles
          </Text>
          {data.weak_areas.length === 0 ? (
            <Card>
              <Text className="text-base text-[#E7ECF2]">
                Every muscle is at target this week. Nice work. 💪
              </Text>
            </Card>
          ) : (
            <Card className="gap-3">
              {data.weak_areas.slice(0, 8).map((w) => (
                <WeakRow
                  key={w.muscle}
                  area={w}
                  target={data.target_sets_per_muscle}
                />
              ))}
            </Card>
          )}

          {/* Suggested workouts */}
          {data.suggested_templates.length > 0 ? (
            <>
              <Text className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#8A97A6]">
                Suggested workouts
              </Text>
              {data.suggested_templates.map((s) => (
                <SuggestionCard key={s.template.id} suggestion={s} />
              ))}
            </>
          ) : data.weak_areas.length > 0 ? (
            <Text className="px-1 text-sm text-[#8A97A6]">
              No published library workouts target these yet — check back as the
              library grows.
            </Text>
          ) : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function WeakRow({ area, target }: { area: WeakArea; target: number }) {
  const pct = Math.min(100, Math.round((area.sets / Math.max(1, target)) * 100));
  return (
    <View>
      <View className="mb-1 flex-row justify-between">
        <Text className="text-sm text-[#E7ECF2]">{titleCase(area.muscle)}</Text>
        <Text className="text-sm text-[#8A97A6]">
          {area.sets} / {target} sets
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-[#22241D]">
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: colors.accent }}
        />
      </View>
    </View>
  );
}

/** A suggested library workout — copy it to your templates and start it. */
function SuggestionCard({ suggestion }: { suggestion: SuggestedTemplate }) {
  const router = useRouter();
  const { template, matched_muscles } = suggestion;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const mine = await api.library.copy(template.id);
      router.replace(`/session?templateId=${mine.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start this workout.");
      setBusy(false);
    }
  }

  return (
    <Pressable onPress={start} disabled={busy}>
      <Card className={busy ? "opacity-60" : ""}>
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 pr-2 text-lg font-semibold text-[#E7ECF2]">
            {template.name}
          </Text>
          <Ionicons name="play-circle" size={24} color={colors.accent} />
        </View>
        <Text className="mt-0.5 text-xs text-[#8A97A6]">
          by {template.author.display_name}
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-1.5">
          {matched_muscles.map((m) => (
            <Pill key={m} label={titleCase(m)} color={colors.accent} />
          ))}
        </View>
        {error ? (
          <Text className="mt-2 text-sm text-[#F87171]">{error}</Text>
        ) : null}
      </Card>
    </Pressable>
  );
}
