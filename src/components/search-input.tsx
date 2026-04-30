import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { BackArrowIcon } from "@/components/icons/back-arrow-icon";
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
  autoFocus?: boolean;
  showBackButtonOnFocus?: boolean;
  keepBackButtonVisible?: boolean;
  onBackPress?: () => void;
  backAccessibilityLabel?: string;
  onFocusChange?: (focused: boolean) => void;
};

export function SearchInput({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  autoFocus = false,
  showBackButtonOnFocus = false,
  keepBackButtonVisible = false,
  onBackPress,
  backAccessibilityLabel = "Close search",
  onFocusChange,
}: SearchInputProps) {
  const { colors, resolvedTheme } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const styles = createStyles(colors, resolvedTheme);
  const inputRef = useRef<TextInput>(null);
  const hasValue = Boolean(value.trim());
  const showBackButton =
    showBackButtonOnFocus && (isFocused || hasValue || keepBackButtonVisible);

  const handleBackPress = () => {
    onBackPress?.();
    inputRef.current?.blur();
  };

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
      ]}
    >
      {showBackButton ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          hitSlop={6}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          onPress={handleBackPress}
        >
          <BackArrowIcon color={colors.text} size={20} />
        </Pressable>
      ) : (
        <SearchInputIcon color={isFocused ? colors.inputFocus : colors.mutedText} size={18} />
      )}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholderText}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={styles.input}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        selectionColor={colors.accent}
        onFocus={() => {
          setIsFocused(true);
          onFocusChange?.(true);
        }}
        onBlur={() => {
          setIsFocused(false);
          onFocusChange?.(false);
        }}
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
  const containerBorderColor = isDarkTheme
    ? colors.inputBorderHover
    : colors.inputBorder || outlineColor;
  const containerBackgroundColor = isDarkTheme ? colors.surfaceMuted : colors.inputBorder;

  return StyleSheet.create({
    container: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: containerBorderColor,
      backgroundColor: containerBackgroundColor,
      paddingLeft: SPACING.md,
      paddingRight: SPACING.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      ...(isDarkTheme ? null : SHADOWS.sm),
    },
    containerFocused: {
      borderColor: "transparent",
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
    backButton: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    backButtonPressed: {
      opacity: 0.82,
    },
    clearButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      borderWidth: 0,
      borderColor: "transparent",
    },
    clearButtonPressed: {
      opacity: 0.82,
    },
  });
};
