import { Redirect, useLocalSearchParams } from "expo-router";

import { isMainTabName, normalizeMainTabParam } from "@/components/main-tabs/main-tabs-config";

export default function MainTabRedirectScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string | string[] }>();
  const normalizedTab = normalizeMainTabParam(tab) ?? "";

  if (!normalizedTab || !isMainTabName(normalizedTab)) {
    return <Redirect href="/home" />;
  }

  if (normalizedTab === "home") {
    return <Redirect href="/home" />;
  }

  return <Redirect href={{ pathname: "/home", params: { tab: normalizedTab } }} />;
}