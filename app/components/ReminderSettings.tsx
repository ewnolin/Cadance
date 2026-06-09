import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import {
  applyReminder,
  loadReminder,
  type Reminder,
} from "../lib/notifications";
import { colors } from "../lib/theme";
import { Button, Card, TextField } from "./ui";

function fmtTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTime(text: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** Daily local-notification reminder controls (lives on the Account screen). */
export function ReminderSettings() {
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [timeText, setTimeText] = useState("18:00");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadReminder().then((r) => {
      setReminder(r);
      setTimeText(fmtTime(r.hour, r.minute));
    });
  }, []);

  async function update(next: Reminder) {
    setBusy(true);
    setMsg(null);
    const err = await applyReminder(next);
    // Re-read the persisted state so a denied permission reflects as "off".
    const saved = await loadReminder();
    setReminder(saved);
    setTimeText(fmtTime(saved.hour, saved.minute));
    setMsg(err);
    setBusy(false);
  }

  if (!reminder) return null;

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-base font-semibold text-[#E7ECF2]">
            Daily reminder
          </Text>
          <Text className="text-xs text-[#8A97A6]">
            A nudge to log your workout.
          </Text>
        </View>
        <Switch
          value={reminder.enabled}
          disabled={busy}
          onValueChange={(v) => {
            const t = parseTime(timeText) ?? {
              hour: reminder.hour,
              minute: reminder.minute,
            };
            update({ enabled: v, ...t });
          }}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor={colors.text}
        />
      </View>

      {reminder.enabled ? (
        <View className="flex-row items-end gap-3">
          <TextField
            className="flex-1"
            label="Time (24h, HH:MM)"
            value={timeText}
            onChangeText={setTimeText}
            placeholder="18:00"
            keyboardType="numbers-and-punctuation"
          />
          <Button
            title="Set"
            loading={busy}
            className="px-6"
            onPress={() => {
              const t = parseTime(timeText);
              if (!t) {
                setMsg("Enter a time as HH:MM (24-hour).");
                return;
              }
              update({ enabled: true, ...t });
            }}
          />
        </View>
      ) : null}

      {msg ? <Text className="text-sm text-[#FFB35C]">{msg}</Text> : null}
    </Card>
  );
}
