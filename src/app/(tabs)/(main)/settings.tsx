import { Redirect } from "expo-router";

export default function SettingsScreen() {
  return <Redirect href={{ pathname: "/home", params: { tab: "settings" } }} />;
}
