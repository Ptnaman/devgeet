import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { CancelInputIcon } from "@/components/icons/cancel-input-icon";
import { SearchInputIcon } from "@/components/icons/search-input-icon";
import {
  CONTROL_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

type SearchInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
};

export function SearchInput({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: SearchInputProps) {
  const { colors, resolvedTheme } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const styles = createStyles(colors, resolvedTheme);
  const hasValue = Boolean(value.trim());

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
      ]}
    >
      <SearchInputIcon color={isFocused ? colors.accent : colors.mutedText} size={18} />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholderText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        selectionColor={colors.accent}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />

      {hasValue ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={6}
          style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
          onPress={() => onChangeText("")}
        >
          <CancelInputIcon color={colors.mutedText} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors, resolvedTheme: "light" | "dark") => {
  const isDarkTheme = resolvedTheme === "dark";
  const outlineColor = isDarkTheme ? colors.divider : colors.border;

  return StyleSheet.create({
    container: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.inputBorder || outlineColor,
      backgroundColor: isDarkTheme ? colors.surface : colors.inputBorder,
      paddingLeft: SPACING.md,
      paddingRight: SPACING.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      ...(isDarkTheme ? null : SHADOWS.sm),
    },
    containerFocused: {
      borderColor: colors.accent,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      height: CONTROL_SIZE.inputHeight,
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
      paddingTop: 0,
      paddingBottom: 0,
      paddingHorizontal: 0,
      textAlignVertical: "center",
    },
    clearButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDarkTheme ? colors.surfaceSoft : colors.surface,
      borderWidth: 1,
      borderColor: outlineColor,
    },
    clearButtonPressed: {
      opacity: 0.82,
    },
  });
};
