import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ApiError } from "./api";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** True only on the initial load (no data yet). */
  initialLoading: boolean;
  reload: () => void;
}

/**
 * Runs `fetcher` on mount, whenever a key in `deps` changes, and every time the
 * screen regains focus (so data stays fresh after creating/deleting elsewhere).
 */
export function useApiData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await run());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return {
    data,
    error,
    loading,
    initialLoading: loading && data === null,
    reload: load,
  };
}
