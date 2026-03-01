import { StyleSheet, Text, View } from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FavouriteIcon } from "@hugeicons/core-free-icons";

export default function FavoriteScreen() {
  return (
    <View style={styles.container}>
      <HugeiconsIcon icon={FavouriteIcon} size={56} color="#111827" />
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
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
