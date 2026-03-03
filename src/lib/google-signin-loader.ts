type GoogleOneTapSignInApi = {
  configure: (params: { webClientId: string; iosClientId?: string }) => void;
  checkPlayServices: (showErrorResolutionDialog?: boolean) => Promise<unknown>;
  signIn: () => Promise<unknown>;
  createAccount: () => Promise<unknown>;
  presentExplicitSignIn: () => Promise<unknown>;
  signOut: () => Promise<null>;
};

type GoogleSigninApi = {
  configure: (params: { webClientId?: string; iosClientId?: string }) => void;
  hasPlayServices: (options: {
    showPlayServicesUpdateDialog: boolean;
  }) => Promise<boolean>;
  signIn: () => Promise<unknown>;
  getTokens: () => Promise<{ idToken: string; accessToken: string }>;
  signOut: () => Promise<null>;
};

export type GoogleSignInModuleLike = {
  GoogleSignin: GoogleSigninApi;
  GoogleOneTapSignIn?: GoogleOneTapSignInApi;
  isErrorWithCode: (error: unknown) => error is { code: string };
  isSuccessResponse: (response: unknown) => boolean;
  isNoSavedCredentialFoundResponse: (response: unknown) => boolean;
  statusCodes: {
    SIGN_IN_CANCELLED: string;
    IN_PROGRESS: string;
    PLAY_SERVICES_NOT_AVAILABLE: string;
  };
};

let cachedModule: GoogleSignInModuleLike | null | undefined;

export const loadGoogleSignInModule = () => {
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  try {
    cachedModule = require(
      "@react-native-google-signin/google-signin"
    ) as GoogleSignInModuleLike;
    return cachedModule;
  } catch {
    cachedModule = null;
    return cachedModule;
  }
};

