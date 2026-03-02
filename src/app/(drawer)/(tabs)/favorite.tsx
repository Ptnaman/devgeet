import { StyleSheet, Text, View } from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { COLORS, FONT_SIZE, SPACING } from "@/constants/theme";

export default function FavoriteScreen() {
  return (
    <View style={styles.container}>
      <HugeiconsIcon icon={FavouriteIcon} size={56} color={COLORS.primary} />
      <Text style={styles.title}>Favorite</Text>
      <Text style={styles.subtitle}>Your saved content will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xxl,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZE.body,
    color: COLORS.mutedText,
    textAlign: "center",
  },
});
