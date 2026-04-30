import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { UserAvatarIcon } from "@/components/icons/user-avatar-icon";
import { type ThemeColors } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

const getAvatarUri = (...values: (string | null | undefined)[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

type HeaderProfileButtonProps = {
  onPress: () => void;
  backgroundColor?: string;
};

export function HeaderProfileButton({ onPress, backgroundColor }: HeaderProfileButtonProps) {
  const { colors } = useAppTheme();
  const { user, profile } = useAuth();
  const [hasImageError, setHasImageError] = useState(false);
  const avatarUri = getAvatarUri(profile?.photoURL, user?.photoURL);
  const shouldShowPhoto = Boolean(avatarUri) && !hasImageError;
  const styles = createStyles(colors, backgroundColor);

  useEffect(() => {
    setHasImageError(false);
  }, [avatarUri]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      hitSlop={6}
      style={({ hovered, pressed }) => [
        styles.profileButton,
        (hovered || pressed) && styles.buttonActive,
      ]}
      onPress={onPress}
    >
      {shouldShowPhoto ? (
        <Image
          source={{ uri: avatarUri }}
          style={styles.avatarImage}
          onError={() => setHasImageError(true)}
        />
      ) : (
        <View style={[styles.avatarImage, styles.avatarFallback]}>
          <UserAvatarIcon size={20} color={colors.text} />
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors, backgroundColor?: string) => StyleSheet.create({
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 999,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  buttonActive: {
    backgroundColor: backgroundColor ?? colors.surfaceMuted,
  },
});