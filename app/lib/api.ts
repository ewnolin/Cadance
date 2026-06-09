import Constants from "expo-constants";

/**
 * Base URL for the Cadance API.
 *
 * In dev the Metro host (e.g. "192.168.1.5:8081" on a LAN, "localhost:8081" on
 * web) tells us where the dev machine is; the API runs on the same host at port
 * 4000. Override explicitly with EXPO_PUBLIC_API_URL for staging/prod.
 */
function deriveBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override.replace(/\/+$/, "");

  const hostUri =
    Constants.expoConfig?.hostUri ??
    // older runtimes stash it here
    (Constants as unknown as { expoGoConfig?: { hostUri?: string } })
      .expoGoConfig?.hostUri;
  const host = hostUri ? hostUri.split(":")[0] : "localhost";
  return `http://${host}:4000`;
}

export const API_BASE_URL = deriveBaseUrl();

/** Error carrying the API's human-readable message and HTTP status. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface Envelope<T> {
  data: T | null;
  error: string | null;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      // Send/receive the cadance.sid session cookie. The browser attaches it on
      // web; React Native's native cookie store persists it on device.
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      `Can't reach the server at ${API_BASE_URL}. Is the API running?`,
      0
    );
  }

  let envelope: Envelope<T> | null = null;
  try {
    envelope = (await res.json()) as Envelope<T>;
  } catch {
    // Non-JSON response (proxy error page, etc.)
  }

  if (!res.ok || (envelope && envelope.error)) {
    const message = envelope?.error ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return (envelope?.data ?? null) as T;
}

export const http = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};

// ---- Shared types (mirror api/src/db/* and api/src/lib/validation.ts) ----

export interface User {
  id: number;
  email: string;
  created_at: string;
  updated_at: string;
}

export const WORKOUT_TYPES = ["strength", "run", "cycle", "yoga"] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const WORKOUT_FEELS = ["easy", "moderate", "hard", "max"] as const;
export type WorkoutFeel = (typeof WORKOUT_FEELS)[number];

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "lats",
  "traps",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface ExerciseSet {
  reps: number;
  weight_kg: number;
  rpe?: number | null;
}
export interface Exercise {
  id: number;
  catalog_id: number | null;
  name: string;
  position: number;
  sets: ExerciseSet[];
}

export interface CardioDetails {
  distance_km: number;
  elevation_m?: number;
  route_geojson?: unknown;
}
export interface YogaDetails {
  style: string;
  intensity: "gentle" | "moderate" | "power";
}

export interface Workout {
  id: number;
  user_id: number;
  type: WorkoutType;
  date: string;
  duration_s: number | null;
  notes: string | null;
  feel: WorkoutFeel | null;
  details?: CardioDetails | YogaDetails | null;
  exercises?: Exercise[];
  created_at: string;
  updated_at: string;
}

/** Fields every workout type accepts. */
interface WorkoutBaseInput {
  date: string;
  duration_s?: number | null;
  notes?: string;
  feel?: WorkoutFeel | null;
}

/** Discriminated input that matches the API's workoutSchema. */
export type WorkoutInput =
  | (WorkoutBaseInput & {
      type: "strength";
      exercises: {
        name: string;
        catalog_id?: number | null;
        sets: ExerciseSet[];
      }[];
    })
  | (WorkoutBaseInput & { type: "run" | "cycle"; details: CardioDetails })
  | (WorkoutBaseInput & { type: "yoga"; details: YogaDetails });

// ---- Exercise catalog (muscle-group taxonomy) ----

export interface CatalogEntry {
  id: number;
  created_by: number | null;
  name: string;
  category: string;
  equipment: string;
  primary_muscles: MuscleGroup[];
  secondary_muscles: MuscleGroup[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogFilters {
  muscle?: MuscleGroup;
  q?: string;
  equipment?: string;
  category?: string;
}

/** One past occurrence of an exercise, carrying its workout's date. */
export interface ExerciseHistoryEntry {
  id: number;
  name: string;
  date: string;
  sets: ExerciseSet[];
}

// ---- Workout templates ----

export interface TemplateExercise {
  id: number;
  template_id: number;
  user_id: number;
  catalog_id: number | null;
  name: string;
  position: number;
  target_sets: number | null;
  target_reps: string | null;
  notes: string | null;
}

export interface WorkoutTemplate {
  id: number;
  user_id: number;
  name: string;
  notes: string | null;
  is_public: boolean;
  exercises: TemplateExercise[];
  created_at: string;
  updated_at: string;
}

export interface TemplateExerciseInput {
  name: string;
  catalog_id?: number | null;
  target_sets?: number | null;
  target_reps?: string | null;
  notes?: string | null;
}

export interface WorkoutTemplateInput {
  name: string;
  notes?: string | null;
  exercises: TemplateExerciseInput[];
}

/** Author attribution shown next to shared library content. */
export interface PublicProfile {
  user_id: number;
  display_name: string;
}

/** A template as seen in the public library: with author + trained muscles. */
export interface LibraryTemplate extends WorkoutTemplate {
  author: PublicProfile;
  muscles: MuscleGroup[];
}

export interface LibraryFilters {
  muscle?: MuscleGroup;
  q?: string;
}

// ---- Recommendations (weak-area analysis) ----

export interface WeakArea {
  muscle: MuscleGroup;
  sets: number;
  deficit: number;
}

export interface SuggestedTemplate {
  template: LibraryTemplate;
  matched_muscles: MuscleGroup[];
  score: number;
}

export interface Recommendations {
  range: { from: string; to: string; days: number };
  target_sets_per_muscle: number;
  muscle_volume: Record<MuscleGroup, number>;
  weak_areas: WeakArea[];
  recently_trained: MuscleGroup[];
  suggested_templates: SuggestedTemplate[];
}

export interface FoodLog {
  id: number;
  user_id: number;
  date: string;
  meal: MealType;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
  updated_at: string;
}

export interface FoodLogInput {
  date: string;
  meal: MealType;
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface BodyWeight {
  id: number;
  user_id: number;
  date: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface BodyWeightInput {
  date: string;
  weight_kg: number;
  note?: string | null;
}

export interface FoodSummary {
  date: string;
  count: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ExercisePR {
  name: string;
  weight: number;
  reps: number;
  est_1rm: number;
}

export interface Stats {
  total_workouts: number;
  sets_this_week: number;
  weekly: { week_start: string; count: number }[];
  prs: ExercisePR[];
}

export interface Dashboard {
  range: { from: string; to: string; days: number };
  workouts: {
    total: number;
    total_duration_s: number;
    by_type: Record<WorkoutType, number>;
  };
  nutrition: {
    days_logged: number;
    total_calories: number;
    totals: { protein: number; carbs: number; fat: number };
    avg_calories_per_logged_day: number;
  };
  streaks: { workouts: number; nutrition: number };
  daily: Array<{
    date: string;
    workouts: number;
    workout_duration_s: number;
    calories: number;
  }>;
}

// ---- Endpoint helpers ----

export const api = {
  auth: {
    me: () => http.get<User>("/auth/me"),
    login: (email: string, password: string) =>
      http.post<User>("/auth/login", { email, password }),
    register: (email: string, password: string) =>
      http.post<User>("/auth/register", { email, password }),
    logout: () => http.post<{ loggedOut: boolean }>("/auth/logout"),
  },
  workouts: {
    list: (type?: WorkoutType) =>
      http.get<Workout[]>(`/workouts${type ? `?type=${type}` : ""}`),
    create: (input: WorkoutInput) => http.post<Workout>("/workouts", input),
    update: (id: number, input: WorkoutInput) =>
      http.put<Workout>(`/workouts/${id}`, input),
    remove: (id: number) => http.del<{ deleted: boolean }>(`/workouts/${id}`),
  },
  exercises: {
    names: () => http.get<string[]>("/exercises/names"),
    history: (name: string) =>
      http.get<ExerciseHistoryEntry[]>(
        `/exercises?name=${encodeURIComponent(name)}`
      ),
    catalog: (filters: CatalogFilters = {}) => {
      const qs = new URLSearchParams();
      if (filters.muscle) qs.set("muscle", filters.muscle);
      if (filters.q) qs.set("q", filters.q);
      if (filters.equipment) qs.set("equipment", filters.equipment);
      if (filters.category) qs.set("category", filters.category);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return http.get<CatalogEntry[]>(`/exercises/catalog${suffix}`);
    },
  },
  templates: {
    list: () => http.get<WorkoutTemplate[]>("/workout-templates"),
    get: (id: number) => http.get<WorkoutTemplate>(`/workout-templates/${id}`),
    create: (input: WorkoutTemplateInput) =>
      http.post<WorkoutTemplate>("/workout-templates", input),
    update: (id: number, input: WorkoutTemplateInput) =>
      http.put<WorkoutTemplate>(`/workout-templates/${id}`, input),
    remove: (id: number) =>
      http.del<{ deleted: boolean }>(`/workout-templates/${id}`),
    publish: (id: number) =>
      http.post<WorkoutTemplate>(`/workout-templates/${id}/publish`),
    unpublish: (id: number) =>
      http.post<WorkoutTemplate>(`/workout-templates/${id}/unpublish`),
  },
  library: {
    list: (filters: LibraryFilters = {}) => {
      const qs = new URLSearchParams();
      if (filters.muscle) qs.set("muscle", filters.muscle);
      if (filters.q) qs.set("q", filters.q);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return http.get<LibraryTemplate[]>(`/library${suffix}`);
    },
    get: (id: number) => http.get<LibraryTemplate>(`/library/${id}`),
    copy: (id: number) => http.post<WorkoutTemplate>(`/library/${id}/copy`),
  },
  foodLogs: {
    list: (date?: string) =>
      http.get<FoodLog[]>(`/food-logs${date ? `?date=${date}` : ""}`),
    summary: (date?: string) =>
      http.get<FoodSummary>(`/food-logs/summary${date ? `?date=${date}` : ""}`),
    create: (input: FoodLogInput) => http.post<FoodLog>("/food-logs", input),
    remove: (id: number) => http.del<{ deleted: boolean }>(`/food-logs/${id}`),
  },
  dashboard: {
    get: (days = 7) => http.get<Dashboard>(`/dashboard?days=${days}`),
  },
  stats: {
    get: () => http.get<Stats>("/stats"),
  },
  recommendations: {
    get: (days = 7) =>
      http.get<Recommendations>(`/recommendations?days=${days}`),
  },
  bodyWeights: {
    list: () => http.get<BodyWeight[]>("/body-weights"),
    create: (input: BodyWeightInput) =>
      http.post<BodyWeight>("/body-weights", input),
    remove: (id: number) =>
      http.del<{ deleted: boolean }>(`/body-weights/${id}`),
  },
  account: {
    changePassword: (currentPassword: string, newPassword: string) =>
      http.post<{ passwordChanged: boolean }>("/account/change-password", {
        currentPassword,
        newPassword,
      }),
  },
};
