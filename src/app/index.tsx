import { Redirect } from "expo-router";

import { AppScreenLoader } from "@/components/app-screen-loader";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function IndexGate() {
  const { colors } = useAppTheme();
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <AppScreenLoader backgroundColor="transparent" indicatorColor={colors.primary} />;
  }

  if (user) {
    return <Redirect href="/home" />;
  }

  return <Redirect href="/auth-choice" />;
}
