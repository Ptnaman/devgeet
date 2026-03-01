import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowRight01Icon, GoogleIcon } from "@hugeicons/core-free-icons";

import { COLORS, CONTROL_SIZE, FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

WebBrowser.maybeCompleteAuthSession();

type GoogleAuthButtonProps = {
  label: string;
  onError: (message: string) => void;
  autoPrompt?: boolean;
};

const resolveGoogleClientIds = () => {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

  return {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ?? extra.googleExpoClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? extra.googleIosClientId,
    androidClientId:
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? extra.googleAndroidClientId,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? extra.googleWebClientId,
  };
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Google sign-in failed. Please try again.";
};

export function GoogleAuthButton({
  label,
  onError,
  autoPrompt = false,
}: GoogleAuthButtonProps) {
  const { loginWithGoogleIdToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasAutoPromptedRef = useRef(false);

  const googleClientIds = useMemo(() => resolveGoogleClientIds(), []);
  const isGoogleConfigured = useMemo(
    () => Boolean(Object.values(googleClientIds).some(Boolean)),
    [googleClientIds]
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleClientIds);

  useEffect(() => {
    if (!response || response.type !== "success") {
      return;
    }

    const run = async () => {
      const idToken = response.params?.id_token;
      if (typeof idToken !== "string" || !idToken) {
        onError("Google did not return an ID token.");
        return;
      }

      try {
        setIsSubmitting(true);
        onError("");
        await loginWithGoogleIdToken(idToken);
      } catch (error) {
        onError(getErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    };

    void run();
  }, [loginWithGoogleIdToken, onError, response]);

  useEffect(() => {
    if (!autoPrompt || hasAutoPromptedRef.current) {
      return;
    }

    if (!request || !isGoogleConfigured) {
      return;
    }

    hasAutoPromptedRef.current = true;

    const run = async () => {
      try {
        setIsSubmitting(true);
        onError("");
        await promptAsync();
      } catch (error) {
        onError(getErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    };

    void run();
  }, [autoPrompt, isGoogleConfigured, onError, promptAsync, request]);

  const handlePress = async () => {
    if (!isGoogleConfigured) {
      onError(
        "Google Client ID is missing. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (and iOS/Android IDs for native)."
      );
      return;
    }

    if (!request) {
      onError("Google sign-in is not ready yet. Try again.");
      return;
    }

    try {
      setIsSubmitting(true);
      onError("");
      await promptAsync();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.googleButton,
        pressed && styles.buttonPressed,
        isSubmitting && styles.buttonDisabled,
      ]}
      disabled={isSubmitting}
      onPress={handlePress}
    >
      <HugeiconsIcon icon={GoogleIcon} size={20} color={COLORS.primary} />
      <Text style={styles.googleButtonText}>{label}</Text>
      {isSubmitting ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={COLORS.primary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  googleButton: {
    width: "100%",
    borderColor: COLORS.border,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    minHeight: CONTROL_SIZE.inputHeight,
    paddingHorizontal: SPACING.md + 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  googleButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.button,
    fontWeight: "600",
    flex: 1,
    marginHorizontal: SPACING.md - 2,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
