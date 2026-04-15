import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import {
  STATIC_COLORS,
} from "@/constants/theme";
import { type UserRole } from "@/lib/access";
import { useAppTheme } from "@/providers/theme-provider";

type VerifiedRoleBadgeProps = {
  role: UserRole;
  size?: "sm" | "md";
};

function VerifiedCheckIcon({
  color,
  size,
}: {
  color: string;
  size: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Circle cx="8" cy="8" r="8" fill={color} />
      <Path
        d="M4.7 8.2L6.8 10.3L11.3 5.8"
        stroke={STATIC_COLORS.white}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

export function VerifiedRoleBadge({
  role,
  size = "sm",
}: VerifiedRoleBadgeProps) {
  const { colors } = useAppTheme();
  if (role === "user") {
    return null;
  }

  const isAdmin = role === "admin";
  const styles = createStyles();
  const iconSize = size === "md" ? 18 : 14;

  return (
    <View style={size === "md" ? styles.iconWrapMedium : styles.iconWrapSmall}>
      <VerifiedCheckIcon
        color={isAdmin ? STATIC_COLORS.favoriteRemove : colors.accent}
        size={iconSize}
      />
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    iconWrapSmall: {
      alignSelf: "center",
      marginTop: 1,
    },
    iconWrapMedium: {
      alignSelf: "center",
    },
  });
