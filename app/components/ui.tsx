import { forwardRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { colors } from "../lib/theme";

/** A titled card surface. */
export function Card({
  className = "",
  children,
  ...rest
}: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-2xl border border-[#232B36] bg-[#151B23] p-4 ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
}

/** Big-number stat tile. */
export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card className="flex-1">
      <Text className="text-xs uppercase tracking-wider text-[#8A97A6]">
        {label}
      </Text>
      <Text
        className={`mt-1 text-3xl font-bold ${
          accent ? "text-[#A3E635]" : "text-[#E7ECF2]"
        }`}
      >
        {value}
      </Text>
      {hint ? (
        <Text className="mt-0.5 text-xs text-[#8A97A6]">{hint}</Text>
      ) : null}
    </Card>
  );
}

/** Small rounded label. */
export function Pill({
  label,
  color = colors.accent,
}: {
  label: string;
  color?: string;
}) {
  return (
    <View
      className="self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: color + "22" }}
    >
      <Text className="text-xs font-semibold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
  ...rest
}: {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  className?: string;
} & PressableProps) {
  const base =
    "flex-row items-center justify-center rounded-xl px-4 py-3.5 active:opacity-80";
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-[#A3E635]",
    ghost: "border border-[#232B36] bg-transparent",
    danger: "border border-[#F87171]/40 bg-[#F87171]/10",
  };
  const textStyles: Record<ButtonVariant, string> = {
    primary: "text-[#0B0F14]",
    ghost: "text-[#E7ECF2]",
    danger: "text-[#F87171]",
  };
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${base} ${styles[variant]} ${
        isDisabled ? "opacity-50" : ""
      } ${className}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? colors.accentText : colors.text}
        />
      ) : (
        <Text className={`text-base font-semibold ${textStyles[variant]}`}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export const TextField = forwardRef<
  TextInput,
  TextInputProps & { label?: string }
>(function TextField({ label, className = "", ...rest }, ref) {
  return (
    <View className={className}>
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-[#8A97A6]">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        className="rounded-xl border border-[#232B36] bg-[#0F141A] px-4 py-3.5 text-base text-[#E7ECF2]"
        {...rest}
      />
    </View>
  );
});

/** Centered message for empty/error states. */
export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="items-center justify-center py-12">
      <Text className="text-base font-semibold text-[#E7ECF2]">{title}</Text>
      {subtitle ? (
        <Text className="mt-1 text-center text-sm text-[#8A97A6]">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
