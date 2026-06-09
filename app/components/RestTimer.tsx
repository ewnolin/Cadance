import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../lib/theme";

export interface RestTimerHandle {
  /** Begin (or restart) the rest countdown — called after a set is logged. */
  start: () => void;
}

const PRESETS = [60, 90, 120, 180];

function fmt(total: number): string {
  const sign = total < 0 ? "-" : "";
  const s = Math.abs(total);
  return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * A between-sets rest timer. Counts toward a target (default 90s) and turns
 * accent-green when the rest is up; tap a preset to (re)start with a new target,
 * or reset to stop. The session auto-starts it each time a set is added.
 */
export const RestTimer = forwardRef<RestTimerHandle, { defaultTarget?: number }>(
  function RestTimer({ defaultTarget = 90 }, ref) {
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [target, setTarget] = useState<number>(defaultTarget);
    const [now, setNow] = useState(Date.now());

    useImperativeHandle(
      ref,
      () => ({
        start: () => {
          const t = Date.now();
          setStartedAt(t);
          setNow(t);
        },
      }),
      []
    );

    useEffect(() => {
      if (startedAt == null) return;
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }, [startedAt]);

    const running = startedAt != null;
    const elapsed = running ? Math.floor((now - startedAt) / 1000) : 0;
    const remaining = target - elapsed;
    const done = running && remaining <= 0;

    const display = running ? fmt(Math.max(remaining, -3599)) : fmt(target);

    function startWith(t: number) {
      const t0 = Date.now();
      setTarget(t);
      setStartedAt(t0);
      setNow(t0);
    }

    return (
      <View
        className={`rounded-2xl border p-3 ${
          done
            ? "border-[#A3E635] bg-[#191B16]"
            : "border-[#232B36] bg-[#0F141A]"
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Ionicons
              name="timer-outline"
              size={18}
              color={done ? colors.accent : colors.muted}
            />
            <Text className="text-xs uppercase tracking-wider text-[#8A97A6]">
              {running ? (done ? "Rest done" : "Resting") : "Rest timer"}
            </Text>
          </View>
          <Text
            className={`text-2xl font-bold ${
              done ? "text-[#A3E635]" : "text-[#E7ECF2]"
            }`}
          >
            {display}
          </Text>
        </View>

        <View className="mt-3 flex-row items-center gap-2">
          {PRESETS.map((p) => {
            const selected = running && target === p;
            return (
              <Pressable
                key={p}
                onPress={() => startWith(p)}
                className={`flex-1 items-center rounded-lg py-2 active:opacity-80 ${
                  selected ? "bg-[#22241D]" : "border border-[#232B36]"
                }`}
              >
                <Text className="text-xs font-semibold text-[#8A97A6]">
                  {fmt(p)}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setStartedAt(null)}
            disabled={!running}
            className="rounded-lg border border-[#232B36] px-3 py-2 active:opacity-80"
          >
            <Ionicons
              name="refresh"
              size={16}
              color={running ? colors.muted : colors.border}
            />
          </Pressable>
        </View>
      </View>
    );
  }
);
