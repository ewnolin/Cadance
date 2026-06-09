/**
 * Color palette for the dark "fitness" aesthetic. NativeWind handles most
 * styling via className; these constants are for APIs that need real color
 * strings (navigation/tab bar, StatusBar, charts).
 */
export const colors = {
  bg: "#0B0F14",
  card: "#151B23",
  cardElevated: "#1B232D",
  border: "#232B36",
  text: "#E7ECF2",
  muted: "#8A97A6",
  accent: "#A3E635", // lime-400
  accentText: "#0B0F14",
  danger: "#F87171",
} as const;

/** Per-workout-type accent, used for chips and dots. */
export const workoutTypeColor: Record<string, string> = {
  strength: "#A3E635",
  run: "#38BDF8",
  cycle: "#FBBF24",
  yoga: "#C084FC",
};
