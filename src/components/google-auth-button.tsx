import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from "react-native";
import Constants from "expo-constants";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowRight01Icon, GoogleIcon } from "@hugeicons/core-free-icons";

import { COLORS, CONTROL_SIZE, FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import {
  loadGoogleSignInModule,
  type GoogleSignInModuleLike,
} from "@/lib/google-signin-loader";
import { useAuth } from "@/providers/auth-provider";

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

const resolveGoogleClientIds = () => {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

  return {
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? extra.googleIosClientId,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? extra.googleWebClientId,
  };
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Google sign-in failed. Please try again.";
};

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
  const { loginWithGoogleIdToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasAutoPromptedRef = useRef(false);

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

  const runOneTapFlow = async () => {
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
  };

  const handlePress = useCallback(async () => {
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

      if (hasOneTapApi) {
        const oneTapResponse = await runOneTapFlow();
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

      onError(getErrorMessage(error));
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
  ]);

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
    void handlePress();
  }, [
    autoPrompt,
    handlePress,
    hasNativeGoogleSignIn,
    hasOneTapApi,
    isGoogleConfigured,
    isWeb,
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
