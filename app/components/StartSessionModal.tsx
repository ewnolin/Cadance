import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { colors } from "../lib/theme";
import { EmptyState } from "./ui";

/**
 * Pick what to start a live session from: an empty session, or one of the
 * user's saved templates (seeds the session with its exercises).
 */
export function StartSessionModal({
  visible,
  onStart,
  onClose,
}: {
  visible: boolean;
  onStart: (templateId: number | null) => void;
  onClose: () => void;
}) {
  const { data, error, initialLoading } = useApiData(
    () => api.templates.list(),
    []
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-[#0B0F14]" edges={["top"]}>
        <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
          <Text className="text-2xl font-extrabold text-[#E7ECF2]">
            Start a session
          </Text>
          <Pressable onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerClassName="px-5 pb-10 gap-2"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => onStart(null)}
            className="flex-row items-center gap-3 rounded-2xl border border-dashed border-[#232B36] bg-[#0F141A] p-4 active:opacity-80"
          >
            <Ionicons name="flash-outline" size={20} color={colors.accent} />
            <Text className="text-base font-semibold text-[#E7ECF2]">
              Empty session
            </Text>
          </Pressable>

          <Text className="mt-3 text-xs font-semibold uppercase tracking-wider text-[#8A97A6]">
            From a template
          </Text>

          {error ? (
            <EmptyState title="Couldn't load templates" subtitle={error} />
          ) : initialLoading ? (
            <EmptyState title="Loading…" />
          ) : (data ?? []).length === 0 ? (
            <EmptyState
              title="No templates yet"
              subtitle="Save a workout as a template, or browse the library."
            />
          ) : (
            (data ?? []).map((t) => (
              <Pressable
                key={t.id}
                onPress={() => onStart(t.id)}
                className="rounded-2xl border border-[#232B36] bg-[#151B23] p-4 active:opacity-80"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-[#E7ECF2]">
                    {t.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </View>
                <Text className="mt-0.5 text-xs text-[#8A97A6]">
                  {t.exercises.length} exercise
                  {t.exercises.length === 1 ? "" : "s"}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
