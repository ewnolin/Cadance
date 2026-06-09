import { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  api,
  MEAL_TYPES,
  type FoodLog,
  type FoodLogInput,
  type MealType,
} from "../../lib/api";
import { useApiData } from "../../lib/useApi";
import { addDays, formatDateLabel, titleCase, todayISO } from "../../lib/format";
import { colors } from "../../lib/theme";
import { Card, EmptyState } from "../../components/ui";
import { FoodForm } from "../../components/FoodForm";

export default function Food() {
  const [date, setDate] = useState(todayISO());
  const [adding, setAdding] = useState(false);

  const logs = useApiData(() => api.foodLogs.list(date), [date]);
  const summary = useApiData(() => api.foodLogs.summary(date), [date]);

  const isToday = date === todayISO();

  async function createLog(input: FoodLogInput) {
    await api.foodLogs.create(input);
    setAdding(false);
    logs.reload();
    summary.reload();
  }

  function confirmDelete(log: FoodLog) {
    const doDelete = async () => {
      await api.foodLogs.remove(log.id);
      logs.reload();
      summary.reload();
    };
    if (Platform.OS === "web") {
      doDelete();
      return;
    }
    Alert.alert("Delete entry?", log.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  }

  const byMeal = (m: MealType) => (logs.data ?? []).filter((l) => l.meal === m);
  const s = summary.data;

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <Text className="text-3xl font-extrabold text-[#E7ECF2]">Food</Text>
        <Pressable
          onPress={() => setAdding(true)}
          className="flex-row items-center gap-1.5 rounded-full bg-[#A3E635] px-4 py-2 active:opacity-80"
        >
          <Ionicons name="add" size={18} color={colors.accentText} />
          <Text className="font-semibold text-[#0B0F14]">Add</Text>
        </Pressable>
      </View>

      {/* Day navigator */}
      <View className="flex-row items-center justify-between px-5 py-2">
        <Pressable
          onPress={() => setDate((d) => addDays(d, -1))}
          className="p-2"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setDate(todayISO())}>
          <Text className="text-base font-semibold text-[#E7ECF2]">
            {isToday ? "Today" : formatDateLabel(date)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setDate((d) => addDays(d, 1))}
          disabled={isToday}
          className="p-2"
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isToday ? colors.border : colors.text}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="px-5 pb-10 gap-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <Card>
          <View className="flex-row items-end justify-between">
            <View>
              <Text className="text-xs uppercase tracking-wider text-[#8A97A6]">
                Calories
              </Text>
              <Text className="text-4xl font-bold text-[#A3E635]">
                {s ? s.calories.toLocaleString() : "—"}
              </Text>
            </View>
            <View className="flex-row gap-4">
              <Macro label="P" value={s?.protein} />
              <Macro label="C" value={s?.carbs} />
              <Macro label="F" value={s?.fat} />
            </View>
          </View>
        </Card>

        {logs.error ? (
          <EmptyState title="Couldn't load entries" subtitle={logs.error} />
        ) : logs.initialLoading ? (
          <EmptyState title="Loading…" />
        ) : (logs.data ?? []).length === 0 ? (
          <EmptyState
            title="Nothing logged"
            subtitle="Tap Add to record what you ate."
          />
        ) : (
          MEAL_TYPES.map((meal) => {
            const items = byMeal(meal);
            if (items.length === 0) return null;
            return (
              <View key={meal} className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-wider text-[#8A97A6]">
                  {titleCase(meal)}
                </Text>
                {items.map((log) => (
                  <Pressable
                    key={log.id}
                    onLongPress={() => confirmDelete(log)}
                    delayLongPress={300}
                  >
                    <Card className="flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-base font-semibold text-[#E7ECF2]">
                          {log.name}
                        </Text>
                        <Text className="mt-0.5 text-xs text-[#8A97A6]">
                          {log.protein}p · {log.carbs}c · {log.fat}f
                        </Text>
                      </View>
                      <Text className="text-base font-semibold text-[#E7ECF2]">
                        {log.calories}
                      </Text>
                    </Card>
                  </Pressable>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={adding}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAdding(false)}
      >
        <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
          <View className="px-5 pb-3 pt-2">
            <Text className="text-2xl font-extrabold text-[#E7ECF2]">
              Add food
            </Text>
            <Text className="text-sm text-[#8A97A6]">
              {isToday ? "Today" : formatDateLabel(date)}
            </Text>
          </View>
          <FoodForm date={date} onSubmit={createLog} onCancel={() => setAdding(false)} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Macro({ label, value }: { label: string; value?: number }) {
  return (
    <View className="items-center">
      <Text className="text-lg font-semibold text-[#E7ECF2]">
        {value != null ? Math.round(value) : "—"}
      </Text>
      <Text className="text-xs text-[#8A97A6]">{label}</Text>
    </View>
  );
}
