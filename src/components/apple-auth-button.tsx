import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import {
  loadAppleAuthenticationModule,
  type AppleAuthenticationModuleLike,
} from "@/lib/apple-authentication-loader";
import { loadExpoCryptoModule } from "@/lib/expo-crypto-loader";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";
import { CONTROL_SIZE, RADIUS, type ThemeColors } from "@/constants/theme";

type AppleAuthButtonMode = "continue" | "signIn" | "signUp";

type AppleAuthButtonProps = {
  onError: (message: string) => void;
  mode?: AppleAuthButtonMode;
};

const NONCE_CHARSET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";

const getErrorMessage = (error: unknown, isConnected: boolean) =>
  getActionErrorMessage({
    error,
    isConnected,
    fallbackMessage: "Apple sign-in failed. Please try again.",
  });

const isCancellationError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "ERR_REQUEST_CANCELED";

const createNonce = (length: number, getRandomBytes: (byteCount: number) => Uint8Array) =>
  Array.from(getRandomBytes(length), (byte) => NONCE_CHARSET[byte % NONCE_CHARSET.length]).join(
    ""
  );

const resolveButtonType = (
  mode: AppleAuthButtonMode,
  appleAuthenticationModule: AppleAuthenticationModuleLike
) => {
  const { AppleAuthenticationButtonType } = appleAuthenticationModule;

  if (mode === "signIn") {
    return AppleAuthenticationButtonType.SIGN_IN;
  }

  if (mode === "signUp") {
    return AppleAuthenticationButtonType.SIGN_UP;
  }

  return AppleAuthenticationButtonType.CONTINUE;
};

export function AppleAuthButton({
  onError,
  mode = "continue",
}: AppleAuthButtonProps) {
  const { colors, resolvedTheme } = useAppTheme();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const { loginWithAppleCredential } = useAuth();
  const [isAvailable, setIsAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const styles = createStyles(colors);

  const appleAuthenticationModule = useMemo(
    () => (Platform.OS === "ios" ? loadAppleAuthenticationModule() : null),
    []
  );

  useEffect(() => {
    let isMounted = true;

    const checkAvailability = async () => {
      if (Platform.OS !== "ios" || !appleAuthenticationModule) {
        if (isMounted) {
          setIsAvailable(false);
        }
        return;
      }

      try {
        const available = await appleAuthenticationModule.isAvailableAsync();
        if (isMounted) {
          setIsAvailable(available);
        }
      } catch {
        if (isMounted) {
          setIsAvailable(false);
        }
      }
    };

    void checkAvailability();

    return () => {
      isMounted = false;
    };
  }, [appleAuthenticationModule]);

  const handlePress = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    if (!isConnected) {
      showOfflineToast();
      onError(DEFAULT_OFFLINE_MESSAGE);
      return;
    }

    const expoCryptoModule = loadExpoCryptoModule();

    if (!appleAuthenticationModule || !expoCryptoModule) {
      onError("Apple sign-in dependencies are missing. Install expo-apple-authentication and expo-crypto.");
      return;
    }

    try {
      setIsSubmitting(true);
      onError("");

      // Firebase validates the raw nonce against the SHA256 value returned by Apple.
      const rawNonce = createNonce(32, expoCryptoModule.getRandomBytes);
      const hashedNonce = await expoCryptoModule.digestStringAsync(
        expoCryptoModule.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await appleAuthenticationModule.signInAsync({
        requestedScopes: [
          appleAuthenticationModule.AppleAuthenticationScope.FULL_NAME,
          appleAuthenticationModule.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        onError("Apple did not return an identity token.");
        return;
      }

      await loginWithAppleCredential({
        idToken: credential.identityToken,
        rawNonce,
        email: credential.email,
        firstName: credential.fullName?.givenName,
        lastName: credential.fullName?.familyName,
      });
    } catch (error) {
      if (isCancellationError(error)) {
        return;
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
    appleAuthenticationModule,
    isConnected,
    isSubmitting,
    loginWithAppleCredential,
    onError,
    showOfflineToast,
  ]);

  if (!isAvailable || !appleAuthenticationModule) {
    return null;
  }

  const AppleAuthenticationButton = appleAuthenticationModule.AppleAuthenticationButton;

  return (
    <View style={[styles.buttonWrap, isSubmitting && styles.buttonWrapDisabled]}>
      <AppleAuthenticationButton
        buttonType={resolveButtonType(mode, appleAuthenticationModule)}
        buttonStyle={
          resolvedTheme === "dark"
            ? appleAuthenticationModule.AppleAuthenticationButtonStyle.WHITE
            : appleAuthenticationModule.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={RADIUS.md}
        style={styles.button}
        onPress={() => {
          void handlePress();
        }}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    buttonWrap: {
      width: "100%",
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      overflow: "hidden",
      backgroundColor: colors.surfaceMuted,
    },
    buttonWrapDisabled: {
      opacity: 0.6,
    },
    button: {
      width: "100%",
      height: CONTROL_SIZE.inputHeight,
    },
  });
