import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MEAL_TYPES, type FoodLogInput, type MealType } from "../lib/api";
import { titleCase } from "../lib/format";
import { Button, TextField } from "./ui";

export function FoodForm({
  date,
  onSubmit,
  onCancel,
}: {
  date: string;
  onSubmit: (input: FoodLogInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [meal, setMeal] = useState<MealType>("breakfast");
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Give the item a name.");
      return;
    }
    const cal = Math.round(Number(calories) || 0);
    if (cal < 0 || calories.trim() === "") {
      setError("Calories are required.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        date,
        meal,
        name: name.trim(),
        calories: cal,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerClassName="px-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="mb-4 flex-row gap-2">
        {MEAL_TYPES.map((m) => {
          const selected = m === meal;
          return (
            <Pressable
              key={m}
              onPress={() => setMeal(m)}
              className={`flex-1 items-center rounded-xl py-2.5 ${
                selected ? "bg-[#A3E635]" : "border border-[#232B36]"
              }`}
            >
              <Text
                className={`text-[11px] font-semibold ${
                  selected ? "text-[#0B0F14]" : "text-[#8A97A6]"
                }`}
              >
                {titleCase(m)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="gap-4">
        <TextField
          label="Item"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Greek yogurt"
        />
        <TextField
          label="Calories"
          value={calories}
          onChangeText={setCalories}
          placeholder="e.g. 220"
          keyboardType="numeric"
        />
        <View className="flex-row gap-3">
          <TextField
            className="flex-1"
            label="Protein (g)"
            value={protein}
            onChangeText={setProtein}
            placeholder="0"
            keyboardType="numeric"
          />
          <TextField
            className="flex-1"
            label="Carbs (g)"
            value={carbs}
            onChangeText={setCarbs}
            placeholder="0"
            keyboardType="numeric"
          />
          <TextField
            className="flex-1"
            label="Fat (g)"
            value={fat}
            onChangeText={setFat}
            placeholder="0"
            keyboardType="numeric"
          />
        </View>

        {error ? <Text className="text-sm text-[#F87171]">{error}</Text> : null}

        <Button title="Add entry" onPress={submit} loading={busy} />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </ScrollView>
  );
}
