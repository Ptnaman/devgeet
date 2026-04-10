import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export type AppleAuthenticationFullNameLike = {
  givenName?: string | null;
  familyName?: string | null;
};

export type AppleAuthenticationCredentialLike = {
  identityToken: string | null;
  email?: string | null;
  fullName?: AppleAuthenticationFullNameLike | null;
};

type AppleAuthenticationButtonProps = {
  buttonType: number;
  buttonStyle: number;
  cornerRadius?: number;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
};

export type AppleAuthenticationModuleLike = {
  AppleAuthenticationButton: ComponentType<AppleAuthenticationButtonProps>;
  AppleAuthenticationButtonType: {
    SIGN_IN: number;
    CONTINUE: number;
    SIGN_UP: number;
  };
  AppleAuthenticationButtonStyle: {
    WHITE: number;
    WHITE_OUTLINE: number;
    BLACK: number;
  };
  AppleAuthenticationScope: {
    FULL_NAME: number;
    EMAIL: number;
  };
  signInAsync: (options: {
    requestedScopes?: number[];
    nonce?: string;
  }) => Promise<AppleAuthenticationCredentialLike>;
  isAvailableAsync: () => Promise<boolean>;
};

let cachedModule: AppleAuthenticationModuleLike | null | undefined;

export const loadAppleAuthenticationModule = () => {
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  try {
    // The native module is loaded lazily so unsupported platforms fail gracefully.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require("expo-apple-authentication") as AppleAuthenticationModuleLike;
    return cachedModule;
  } catch {
    cachedModule = null;
    return cachedModule;
  }
};
