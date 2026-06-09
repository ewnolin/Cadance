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
import { useRouter } from "expo-router";
import { api, type WorkoutTemplate } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { colors } from "../lib/theme";
import { Card, EmptyState, Pill } from "../components/ui";

export default function Templates() {
  const router = useRouter();
  const { data, error, initialLoading, reload } = useApiData(
    () => api.templates.list(),
    []
  );

  async function togglePublish(t: WorkoutTemplate) {
    if (t.is_public) await api.templates.unpublish(t.id);
    else await api.templates.publish(t.id);
    reload();
  }

  function confirmDelete(t: WorkoutTemplate) {
    const doDelete = async () => {
      await api.templates.remove(t.id);
      reload();
    };
    if (Platform.OS === "web") return doDelete();
    Alert.alert("Delete template?", t.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <Pressable onPress={() => router.back()} className="-ml-2 p-2">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text className="text-2xl font-extrabold text-[#E7ECF2]">Templates</Text>
        <Pressable
          onPress={() => router.push("/template-edit")}
          className="flex-row items-center gap-1 rounded-full bg-[#A3E635] px-3 py-1.5 active:opacity-80"
        >
          <Ionicons name="add" size={16} color={colors.accentText} />
          <Text className="text-sm font-semibold text-[#0B0F14]">New</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="px-5 pb-10 gap-3 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <EmptyState title="Couldn't load templates" subtitle={error} />
        ) : initialLoading ? (
          <EmptyState title="Loading…" />
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            title="No templates yet"
            subtitle="Tap New to build a reusable workout."
          />
        ) : (
          (data ?? []).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => router.push(`/template-edit?id=${t.id}`)}
              onLongPress={() => confirmDelete(t)}
              delayLongPress={300}
            >
              <Card>
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 pr-2 text-lg font-semibold text-[#E7ECF2]">
                    {t.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </View>
                <Text className="mt-0.5 text-xs text-[#8A97A6]">
                  {t.exercises.length} exercise{t.exercises.length === 1 ? "" : "s"}
                </Text>
                <View className="mt-3 flex-row items-center justify-between">
                  {t.is_public ? (
                    <Pill label="In library" color={colors.accent} />
                  ) : (
                    <Pill label="Private" color={colors.muted} />
                  )}
                  <Pressable
                    onPress={() => togglePublish(t)}
                    className="rounded-full border border-[#232B36] px-3 py-1.5 active:opacity-80"
                  >
                    <Text className="text-xs font-semibold text-[#E7ECF2]">
                      {t.is_public ? "Unpublish" : "Publish to library"}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
