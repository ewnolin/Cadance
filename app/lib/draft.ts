import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Local persistence for an in-progress live session, so logged sets survive
 * navigating away or the app being killed. Drafts are keyed per source (a
 * template id, or "empty") and cleared on finish/discard.
 */
const PREFIX = "cadance:session-draft:";

export interface SessionDraft<E = unknown> {
  title: string;
  exercises: E[];
  feel: string | null;
}

export async function loadDraft<E>(key: string): Promise<SessionDraft<E> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as SessionDraft<E>) : null;
  } catch {
    return null;
  }
}

export async function saveDraft<E>(key: string, draft: SessionDraft<E>): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(draft));
  } catch {
    // Best-effort: a failed write just means no resume; don't disrupt logging.
  }
}

export async function clearDraft(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
