import { ActivityIndicator, StyleSheet, View } from "react-native";

type AppScreenLoaderProps = {
  backgroundColor: string;
  indicatorColor: string;
};

export function AppScreenLoader({
  backgroundColor,
  indicatorColor,
}: AppScreenLoaderProps) {
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ActivityIndicator size="large" color={indicatorColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});