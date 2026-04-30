import { Pressable, StyleSheet } from "react-native";

import { AdminPanelIcon } from "@/components/icons/admin-panel-icon";
import { type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

type HeaderAdminButtonProps = {
  onPress: () => void;
  backgroundColor?: string;
  accessibilityLabel?: string;
};

export function HeaderAdminButton({
  onPress,
  backgroundColor,
  accessibilityLabel = "Open admin panel",
}: HeaderAdminButtonProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors, backgroundColor);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ hovered, pressed }) => [
        styles.iconButton,
        (hovered || pressed) && styles.iconButtonActive,
      ]}
      onPress={onPress}
    >
      <AdminPanelIcon size={22} color={colors.text} />
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors, backgroundColor?: string) =>
  StyleSheet.create({
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    iconButtonActive: {
      backgroundColor: backgroundColor ?? colors.surfaceMuted,
    },
  });
