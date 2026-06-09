import { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  api,
  type CardioDetails,
  type Workout,
  type WorkoutInput,
  type YogaDetails,
} from "../../lib/api";
import { useApiData } from "../../lib/useApi";
import { formatDateLabel, formatDuration, titleCase } from "../../lib/format";
import { colors, workoutTypeColor } from "../../lib/theme";
import { Card, EmptyState, Pill } from "../../components/ui";
import { WorkoutForm } from "../../components/WorkoutForm";
import { StartSessionModal } from "../../components/StartSessionModal";

/** One-line summary of a workout's defining metric. */
function summarize(w: Workout): string {
  if (w.type === "strength") {
    const n = w.exercises?.length ?? 0;
    const sets =
      w.exercises?.reduce((sum, ex) => sum + ex.sets.length, 0) ?? 0;
    return `${n} exercise${n === 1 ? "" : "s"} · ${sets} set${
      sets === 1 ? "" : "s"
    }`;
  }
  if (w.type === "run" || w.type === "cycle") {
    const d = w.details as CardioDetails | null;
    return d ? `${d.distance_km} km` : "—";
  }
  const y = w.details as YogaDetails | null;
  return y ? `${titleCase(y.style)} · ${y.intensity}` : "—";
}

export default function Workouts() {
  const router = useRouter();
  const { data, error, initialLoading, reload } = useApiData(
    () => api.workouts.list(),
    []
  );
  const [adding, setAdding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [editing, setEditing] = useState<Workout | null>(null);

  async function createWorkout(input: WorkoutInput) {
    await api.workouts.create(input);
    setAdding(false);
    reload();
  }

  async function updateWorkout(input: WorkoutInput) {
    if (!editing) return;
    await api.workouts.update(editing.id, input);
    setEditing(null);
    reload();
  }

  function confirmDelete(w: Workout) {
    const doDelete = async () => {
      await api.workouts.remove(w.id);
      reload();
    };
    if (Platform.OS === "web") {
      // RN Alert has no buttons on web.
      doDelete();
      return;
    }
    Alert.alert("Delete workout?", `${titleCase(w.type)} on ${w.date}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <Text className="text-3xl font-extrabold text-[#E7ECF2]">Workouts</Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setStarting(true)}
            className="flex-row items-center gap-1.5 rounded-full bg-[#A3E635] px-4 py-2 active:opacity-80"
          >
            <Ionicons name="play" size={16} color={colors.accentText} />
            <Text className="font-semibold text-[#0B0F14]">Start</Text>
          </Pressable>
          <Pressable
            onPress={() => setAdding(true)}
            className="flex-row items-center gap-1.5 rounded-full border border-[#232B36] px-4 py-2 active:opacity-80"
          >
            <Ionicons name="add" size={18} color={colors.text} />
            <Text className="font-semibold text-[#E7ECF2]">Log</Text>
          </Pressable>
        </View>
      </View>

      {initialLoading ? (
        <EmptyState title="Loading workouts…" />
      ) : error ? (
        <EmptyState title="Couldn't load workouts" subtitle={error} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(w) => String(w.id)}
          contentContainerClassName="px-5 pb-10 gap-3"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title="No workouts yet"
              subtitle="Tap Log to record your first session."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setEditing(item)}
              onLongPress={() => confirmDelete(item)}
              delayLongPress={300}
            >
              <Card>
                <View className="flex-row items-center justify-between">
                  <Pill
                    label={titleCase(item.type)}
                    color={workoutTypeColor[item.type]}
                  />
                  <Text className="text-sm text-[#8A97A6]">
                    {formatDateLabel(item.date)}
                  </Text>
                </View>
                <Text className="mt-3 text-lg font-semibold text-[#E7ECF2]">
                  {summarize(item)}
                </Text>
                <View className="mt-1 flex-row items-center gap-3">
                  {item.duration_s ? (
                    <Text className="text-sm text-[#8A97A6]">
                      {formatDuration(item.duration_s)}
                    </Text>
                  ) : null}
                  {item.notes ? (
                    <Text
                      className="flex-1 text-sm text-[#8A97A6]"
                      numberOfLines={1}
                    >
                      {item.notes}
                    </Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={adding}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAdding(false)}
      >
        <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
          <View className="px-5 pb-3 pt-2">
            <Text className="text-2xl font-extrabold text-[#E7ECF2]">
              Log workout
            </Text>
          </View>
          <WorkoutForm
            onSubmit={createWorkout}
            onCancel={() => setAdding(false)}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={editing != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditing(null)}
      >
        <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
          <View className="px-5 pb-3 pt-2">
            <Text className="text-2xl font-extrabold text-[#E7ECF2]">
              Edit workout
            </Text>
          </View>
          {editing ? (
            <WorkoutForm
              initial={editing}
              submitLabel="Save changes"
              onSubmit={updateWorkout}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </SafeAreaView>
      </Modal>

      <StartSessionModal
        visible={starting}
        onClose={() => setStarting(false)}
        onManage={() => {
          setStarting(false);
          router.push("/templates");
        }}
        onStart={(templateId) => {
          setStarting(false);
          router.push(
            templateId != null ? `/session?templateId=${templateId}` : "/session"
          );
        }}
      />
    </SafeAreaView>
  );
}
