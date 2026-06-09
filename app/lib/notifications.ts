import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Local daily "log your workout" reminder. Uses a single scheduled local
 * notification (no server/push) whose time the user controls; the setting is
 * persisted so it can be re-applied on launch.
 */

// Show reminders as a banner even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const KEY = "cadance:reminder";

export interface Reminder {
  enabled: boolean;
  hour: number; // 0–23
  minute: number; // 0–59
}

export const DEFAULT_REMINDER: Reminder = { enabled: false, hour: 18, minute: 0 };

export async function loadReminder(): Promise<Reminder> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw
      ? { ...DEFAULT_REMINDER, ...(JSON.parse(raw) as Partial<Reminder>) }
      : DEFAULT_REMINDER;
  } catch {
    return DEFAULT_REMINDER;
  }
}

async function saveReminder(r: Reminder): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // Best-effort persistence.
  }
}

/**
 * Apply (schedule or cancel) the daily reminder and persist it. Returns a
 * user-facing message when something prevented enabling it (web/permission),
 * otherwise null. On permission denial the stored state falls back to disabled.
 */
export async function applyReminder(r: Reminder): Promise<string | null> {
  if (Platform.OS === "web") {
    await saveReminder({ ...r, enabled: false });
    return r.enabled ? "Reminders aren't supported on web." : null;
  }

  // We only ever keep one reminder scheduled — clear before (re)scheduling.
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!r.enabled) {
    await saveReminder(r);
    return null;
  }

  const perm = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  if (!perm.granted) {
    await saveReminder({ ...r, enabled: false });
    return "Notifications permission was denied.";
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Time to train 💪",
      body: "Log today's workout in Cadance.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: r.hour,
      minute: r.minute,
    },
  });
  await saveReminder(r);
  return null;
}
