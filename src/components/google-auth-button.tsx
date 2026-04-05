import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from "react-native";
import Constants from "expo-constants";
import Svg, { Path } from "react-native-svg";

import { ArrowRightIcon } from "@/components/icons/arrow-right-icon";
import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage } from "@/lib/network";
import {
  loadGoogleSignInModule,
  type GoogleSignInModuleLike,
} from "@/lib/google-signin-loader";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

type GoogleAuthButtonProps = {
  label: string;
  onError: (message: string) => void;
  autoPrompt?: boolean;
};

type GoogleSignInResponse = {
  type?: string;
  data?: {
    idToken?: string | null;
  } | null;
  idToken?: string | null;
};

type OneTapFlowMode = "auto" | "explicit";

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" accessibilityRole="image">
      <Path
        fill="#EA4335"
        d="M9 3.48c1.69 0 2.84.73 3.49 1.34l2.54-2.54C13.46.83 11.42 0 9 0 5.48 0 2.44 2.02.96 4.96l2.96 2.3C4.64 5.1 6.62 3.48 9 3.48z"
      />
      <Path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.12-.84 2.07-1.8 2.71v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.61z"
      />
      <Path
        fill="#FBBC05"
        d="M3.92 10.74A5.41 5.41 0 0 1 3.62 9c0-.6.1-1.18.3-1.74V4.96H.96A8.98 8.98 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.96-2.3z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.42 0 4.46-.8 5.95-2.18l-2.92-2.26c-.8.54-1.84.86-3.03.86-2.38 0-4.4-1.61-5.12-3.78l-2.96 2.3C2.44 15.98 5.48 18 9 18z"
      />
    </Svg>
  );
}

const resolveGoogleClientIds = () => {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

  return {
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? extra.googleIosClientId,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? extra.googleWebClientId,
  };
};

const getErrorMessage = (error: unknown, isConnected: boolean) =>
  getActionErrorMessage({
    error,
    isConnected,
    fallbackMessage: "Google sign-in failed. Please try again.",
  });

const getIdToken = async (
  response: unknown,
  includeOriginalTokenFallback: boolean,
  googleSignInModule: GoogleSignInModuleLike
) => {
  const signInResponse = response as GoogleSignInResponse;

  if (signInResponse.type === "cancelled") {
    return null;
  }

  const idToken =
    signInResponse.type === "success"
      ? signInResponse.data?.idToken
      : signInResponse.idToken;

  if (idToken) {
    return idToken;
  }

  if (!includeOriginalTokenFallback) {
    return null;
  }

  const { GoogleSignin } = googleSignInModule;
  const tokens = await GoogleSignin.getTokens();
  return tokens.idToken ?? null;
};

export function GoogleAuthButton({
  label,
  onError,
  autoPrompt = false,
}: GoogleAuthButtonProps) {
  const { colors } = useAppTheme();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const { loginWithGoogleIdToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasAutoPromptedRef = useRef(false);
  const styles = createStyles(colors);

  const googleClientIds = useMemo(() => resolveGoogleClientIds(), []);
  const isWeb = Platform.OS === "web";
  const googleSignInModule = useMemo(() => loadGoogleSignInModule(), []);
  const hasNativeGoogleSignIn = Boolean(googleSignInModule);
  const hasOneTapApi = Boolean(googleSignInModule?.GoogleOneTapSignIn);
  const isGoogleConfigured = Boolean(googleClientIds.webClientId);

  useEffect(() => {
    if (!isGoogleConfigured || !googleSignInModule) {
      return;
    }

    const { GoogleSignin, GoogleOneTapSignIn } = googleSignInModule;

    if (hasOneTapApi && GoogleOneTapSignIn) {
      GoogleOneTapSignIn.configure({
        webClientId: googleClientIds.webClientId!,
        iosClientId: googleClientIds.iosClientId,
      });
      return;
    }

    GoogleSignin.configure({
      webClientId: googleClientIds.webClientId,
      iosClientId: googleClientIds.iosClientId,
    });
  }, [
    googleClientIds.iosClientId,
    googleClientIds.webClientId,
    googleSignInModule,
    hasOneTapApi,
    isGoogleConfigured,
  ]);

  const runOneTapFlow = useCallback(async (mode: OneTapFlowMode) => {
    if (!googleSignInModule?.GoogleOneTapSignIn) {
      return null;
    }

    const {
      GoogleOneTapSignIn,
      isErrorWithCode,
      isNoSavedCredentialFoundResponse,
      isSuccessResponse,
    } = googleSignInModule;

    if (Platform.OS === "android") {
      await GoogleOneTapSignIn.checkPlayServices(true);
    } else {
      await GoogleOneTapSignIn.checkPlayServices();
    }

    if (mode === "explicit") {
      const explicitResponse = await GoogleOneTapSignIn.presentExplicitSignIn();
      return isSuccessResponse(explicitResponse as never) ? explicitResponse : null;
    }

    try {
      const signInResponse = await GoogleOneTapSignIn.signIn();
      if (isSuccessResponse(signInResponse as never)) {
        return signInResponse;
      }

      if (isNoSavedCredentialFoundResponse(signInResponse as never)) {
        const createAccountResponse = await GoogleOneTapSignIn.createAccount();
        if (isSuccessResponse(createAccountResponse as never)) {
          return createAccountResponse;
        }

        if (isNoSavedCredentialFoundResponse(createAccountResponse as never)) {
          const explicitResponse = await GoogleOneTapSignIn.presentExplicitSignIn();
          if (isSuccessResponse(explicitResponse as never)) {
            return explicitResponse;
          }
        }
      }

      return null;
    } catch (error) {
      if (isErrorWithCode(error) && error.code === "ONE_TAP_START_FAILED") {
        const explicitResponse = await GoogleOneTapSignIn.presentExplicitSignIn();
        if (isSuccessResponse(explicitResponse as never)) {
          return explicitResponse;
        }
        return null;
      }

      throw error;
    }
  }, [googleSignInModule]);

  const startGoogleSignIn = useCallback(async (mode: OneTapFlowMode) => {
    if (isWeb && !hasOneTapApi) {
      onError(
        "One Tap requires Universal Sign-In package. Configure private registry and reinstall."
      );
      return;
    }

    if (!hasNativeGoogleSignIn || !googleSignInModule) {
      onError(
        "RNGoogleSignin is missing in this binary. Use a development build (expo run:android/ios), not Expo Go."
      );
      return;
    }

    if (!isGoogleConfigured) {
      onError("Google Client ID is missing. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
      return;
    }

    const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } =
      googleSignInModule;

    try {
      setIsSubmitting(true);
      onError("");

      if (!isConnected) {
        showOfflineToast();
        onError(DEFAULT_OFFLINE_MESSAGE);
        return;
      }

      if (hasOneTapApi) {
        const oneTapResponse = await runOneTapFlow(mode);
        if (!oneTapResponse) {
          return;
        }

        const idToken = await getIdToken(oneTapResponse, false, googleSignInModule);
        if (!idToken) {
          onError("Google did not return an ID token.");
          return;
        }

        await loginWithGoogleIdToken(idToken);
        return;
      }

      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response as never)) {
        return;
      }

      const idToken = await getIdToken(response, true, googleSignInModule);
      if (!idToken) {
        onError("Google did not return an ID token.");
        return;
      }

      await loginWithGoogleIdToken(idToken);
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          return;
        }

        if (error.code === statusCodes.IN_PROGRESS) {
          onError("Google sign-in is already in progress.");
          return;
        }

        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          onError("Google Play Services is not available on this device.");
          return;
        }

        if (error.code === "ONE_TAP_START_FAILED") {
          onError("One Tap could not start. Try again.");
          return;
        }
      }

      const message = getErrorMessage(error, isConnected);
      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
      }
      onError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    googleSignInModule,
    hasNativeGoogleSignIn,
    hasOneTapApi,
    isGoogleConfigured,
    isWeb,
    loginWithGoogleIdToken,
    onError,
    runOneTapFlow,
    isConnected,
    showOfflineToast,
  ]);

  const handlePress = useCallback(() => {
    void startGoogleSignIn("explicit");
  }, [startGoogleSignIn]);

  useEffect(() => {
    if (!autoPrompt || hasAutoPromptedRef.current) {
      return;
    }

    if (
      !isGoogleConfigured ||
      !hasNativeGoogleSignIn ||
      (isWeb && !hasOneTapApi)
    ) {
      return;
    }

    hasAutoPromptedRef.current = true;
    void startGoogleSignIn("auto");
  }, [
    autoPrompt,
    hasNativeGoogleSignIn,
    hasOneTapApi,
    isGoogleConfigured,
    isWeb,
    startGoogleSignIn,
  ]);

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
      <GoogleLogo size={20} />
      <Text style={styles.googleButtonText}>{label}</Text>
      {isSubmitting ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <ArrowRightIcon size={18} color={colors.text} />
      )}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  googleButton: {
    width: "100%",
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: RADIUS.pill,
    minHeight: CONTROL_SIZE.inputHeight,
    paddingHorizontal: SPACING.md + 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  googleButtonText: {
    color: colors.text,
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
