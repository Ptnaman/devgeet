import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { Platform } from "react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentReference,
  type DocumentData,
} from "firebase/firestore";

import {
  EMAIL_VALIDATION_MESSAGE,
  PASSWORD_VALIDATION_MESSAGE,
  normalizeEmailAddress as normalizeEmail,
  normalizeUsernameValue as normalizeUsername,
  sanitizeUsername,
  validateUsername,
} from "@/lib/auth-validation";
import {
  canManagePosts as canManagePostsForRole,
  canModeratePosts as canModeratePostsForRole,
  canManageUsers as canManageUsersForRole,
  getEffectiveUserRole,
  normalizeAccountStatus,
  type AccountStatus,
  type UserRole,
} from "@/lib/access";
import { AUTHOR_FOLLOWS_COLLECTION } from "@/lib/author-follows";
import { auth, firestore, getAuthPersistenceForRememberMe } from "@/lib/firebase";
import { loadGoogleSignInModule } from "@/lib/google-signin-loader";

const USERNAMES_COLLECTION = "usernames";
const USERS_COLLECTION = "users";
const FAVORITES_COLLECTION = "favorites";
const PUSH_TOKENS_COLLECTION = "pushTokens";
const USER_NOTIFICATIONS_SUBCOLLECTION = "notifications";
const MAX_BATCH_DELETE_COUNT = 400;
const RECENT_LOGIN_WINDOW_MS = 5 * 60 * 1000;
type AuthProviderName = "password" | "google" | "apple";
const USER_GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;
type UserGender = (typeof USER_GENDERS)[number] | "";

type UserProfile = {
  uid: string;
  username: string;
  usernameLower: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  provider: string;
  displayName: string;
  photoURL: string;
  bio: string;
  gender: UserGender;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  hasProfileDocument: boolean;
  role: UserRole;
  isAdmin: boolean;
  canManagePosts: boolean;
  canModeratePosts: boolean;
  canManageUsers: boolean;
  isBootstrapping: boolean;
  setRememberSessionPersistence: (remember: boolean) => Promise<void>;
  isUsernameAvailable: (username: string, excludeUid?: string) => Promise<boolean>;
  loginWithEmailOrUsername: (identifier: string, password: string) => Promise<void>;
  requestPasswordReset: (identifier: string) => Promise<void>;
  signupWithEmail: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    username?: string;
    password: string;
  }) => Promise<void>;
  updateCurrentUserProfile: (payload: {
    firstName: string;
    lastName: string;
    username: string;
    photoURL: string;
    bio: string;
    gender: string;
  }) => Promise<void>;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  loginWithAppleCredential: (payload: {
    idToken: string;
    rawNonce: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }) => Promise<void>;
  deleteCurrentUserAccount: (currentPassword?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeName = (value: string) => value.trim();
const normalizeOptionalValue = (value: string | null | undefined) => value?.trim() ?? "";
const normalizePhotoUrl = (value: string | null | undefined) => value?.trim() ?? "";
const normalizeGender = (value: string | null | undefined): UserGender => {
  const normalizedValue = value?.trim().toLowerCase() ?? "";
  return USER_GENDERS.includes(normalizedValue as (typeof USER_GENDERS)[number])
    ? (normalizedValue as UserGender)
    : "";
};
const pickFirstNonEmptyValue = (...values: (string | null | undefined)[]) => {
  for (const value of values) {
    const normalizedValue = value?.trim() ?? "";
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return "";
};
const readStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const readUsernameEmail = async (username: string) => {
  const usernameRef = doc(firestore, USERNAMES_COLLECTION, normalizeUsername(username));
  const usernameSnapshot = await getDoc(usernameRef);

  if (!usernameSnapshot.exists()) {
    throw new Error("Username not found.");
  }

  const data = usernameSnapshot.data() as DocumentData;
  const email = data?.email;

  if (typeof email !== "string" || !email) {
    throw new Error("Username is not linked to an email.");
  }

  return normalizeEmail(email);
};

const isUsernameAvailableRecord = async (username: string, excludeUid?: string) => {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) {
    return false;
  }

  const usernameSnapshot = await getDoc(doc(firestore, USERNAMES_COLLECTION, normalizedUsername));

  if (!usernameSnapshot.exists()) {
    return true;
  }

  if (!excludeUid) {
    return false;
  }

  const existingUid = (usernameSnapshot.data() as DocumentData)?.uid;
  return existingUid === excludeUid;
};

const validateName = (label: "First name" | "Last name", value: string) => {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
};

const getFallbackUsername = (email: string | null, uid: string) => {
  const base = email?.split("@")[0] ?? `user_${uid.slice(0, 6)}`;
  const sanitized = sanitizeUsername(base);
  return (sanitized || `user_${uid.slice(0, 6)}`).slice(0, 20);
};

const getEmailSignupUsername = (email: string, uid: string) => {
  const base = sanitizeUsername(email.split("@")[0] ?? "");
  const fallback = base || `user_${uid.slice(0, 6)}`;
  const suffix = uid.slice(0, 4).toLowerCase();
  const head = fallback.slice(0, Math.max(0, 20 - suffix.length - 1));
  return `${head}_${suffix}`;
};

const ensureUniqueProviderUsername = (uid: string, email: string | null) => {
  const base = getFallbackUsername(email, uid);
  const suffix = uid.slice(0, 4).toLowerCase();
  const head = base.slice(0, Math.max(0, 20 - suffix.length - 1));
  return `${head}_${suffix}`;
};

const getNameParts = (displayName: string | null) => {
  const normalizedDisplayName = displayName?.trim() ?? "";
  if (!normalizedDisplayName) {
    return { firstName: "", lastName: "" };
  }

  const [firstName, ...rest] = normalizedDisplayName.split(/\s+/);
  return {
    firstName: normalizeName(firstName),
    lastName: normalizeName(rest.join(" ")),
  };
};

const resolveProvider = (currentUser: User | null | undefined) =>
  currentUser?.providerData.some((item) => item.providerId === "apple.com")
    ? "apple"
    : currentUser?.providerData.some((item) => item.providerId === "google.com")
      ? "google"
      : "password";

const buildUserProfileRecord = (payload: {
  uid: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  accountStatus?: string;
  provider: string;
  displayName?: string | null;
  photoURL?: string | null;
  bio?: string | null;
  gender?: string | null;
}): UserProfile => {
  const normalizedUsername = payload.username.trim();
  const usernameLower = normalizeUsername(normalizedUsername);
  const normalizedFirstName = normalizeName(payload.firstName);
  const normalizedLastName = normalizeName(payload.lastName);
  const normalizedEmail = normalizeEmail(payload.email);
  const effectiveRole = getEffectiveUserRole(payload.role);
  const accountStatus = normalizeAccountStatus(payload.accountStatus);
  const normalizedProvider = payload.provider.trim().toLowerCase() || "password";
  const normalizedDisplayName =
    normalizeName(payload.displayName ?? `${normalizedFirstName} ${normalizedLastName}`) ||
    normalizedUsername;

  return {
    uid: payload.uid,
    username: normalizedUsername,
    usernameLower,
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    email: normalizedEmail,
    role: effectiveRole,
    accountStatus,
    provider: normalizedProvider,
    displayName: normalizedDisplayName,
    photoURL: normalizePhotoUrl(payload.photoURL),
    bio: normalizeOptionalValue(payload.bio),
    gender: normalizeGender(payload.gender),
  };
};

const createFallbackUserProfile = (currentUser: User): UserProfile => {
  const normalizedEmail = normalizeEmail(currentUser.email ?? "");
  const fallbackUsername = getFallbackUsername(normalizedEmail || null, currentUser.uid);
  const { firstName, lastName } = getNameParts(currentUser.displayName);
  const effectiveFirstName = normalizeName(firstName || fallbackUsername);
  const effectiveLastName = normalizeName(lastName);

  return buildUserProfileRecord({
    uid: currentUser.uid,
    username: fallbackUsername,
    firstName: effectiveFirstName,
    lastName: effectiveLastName,
    email: normalizedEmail,
    role: getEffectiveUserRole(undefined),
    accountStatus: "active",
    provider: resolveProvider(currentUser),
    displayName: currentUser.displayName,
    photoURL: currentUser.photoURL,
    bio: "",
    gender: "",
  });
};

const mapUserProfile = (uid: string, data: DocumentData): UserProfile => {
  const normalizedEmail = normalizeEmail(readStringValue(data?.email));
  const fallbackUsername = getFallbackUsername(normalizedEmail || null, uid);
  const username = readStringValue(data?.username) || fallbackUsername;
  const firstName = readStringValue(data?.firstName) || username;
  const lastName = readStringValue(data?.lastName);

  return buildUserProfileRecord({
    uid,
    username,
    firstName,
    lastName,
    email: normalizedEmail,
    role: readStringValue(data?.role) || "user",
    accountStatus: readStringValue(data?.accountStatus) || "active",
    provider: readStringValue(data?.provider) || "password",
    displayName: readStringValue(data?.displayName),
    photoURL: readStringValue(data?.photoURL),
    bio: readStringValue(data?.bio),
    gender: readStringValue(data?.gender),
  });
};

const ensureAccountIsActive = async (uid: string) => {
  const userSnapshot = await getDoc(doc(firestore, USERS_COLLECTION, uid));

  if (!userSnapshot.exists()) {
    return;
  }

  const accountStatus = normalizeAccountStatus(
    readStringValue((userSnapshot.data() as DocumentData)?.accountStatus)
  );

  if (accountStatus === "deleted") {
    throw new Error("This account has been removed by admin.");
  }
};

const isUsernameTakenError = (error: unknown) =>
  error instanceof Error && error.message.toLowerCase().includes("already taken");

const mapEmailSignupError = (error: unknown) => {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  if (code === "auth/email-already-in-use") {
    return new Error("This email is already registered. Please login instead.");
  }

  if (code === "auth/invalid-email") {
    return new Error(EMAIL_VALIDATION_MESSAGE);
  }

  if (code === "auth/weak-password") {
    return new Error(PASSWORD_VALIDATION_MESSAGE);
  }

  if (code === "auth/operation-not-allowed") {
    return new Error("Email signup is not available right now.");
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Unable to create account. Please try again.");
};

const mapPasswordResetError = (error: unknown) => {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  if (code === "auth/invalid-email") {
    return new Error("Enter a valid email or username.");
  }

  if (code === "auth/missing-email") {
    return new Error("Enter your email or username first.");
  }

  if (code === "auth/user-not-found") {
    return new Error("No account found for this email or username.");
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Unable to send reset email. Please try again.");
};

const mapLoginError = (error: unknown, identifier: string) => {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";
  const normalizedIdentifier = identifier.trim();
  const identifierLooksLikeEmail = normalizedIdentifier.includes("@");

  if (code === "auth/invalid-email") {
    return new Error(EMAIL_VALIDATION_MESSAGE);
  }

  if (code === "auth/user-not-found") {
    return new Error(
      identifierLooksLikeEmail
        ? "No account found for this email."
        : "No account found for this username.",
    );
  }

  if (
    code === "auth/wrong-password" ||
    code === "auth/invalid-credential" ||
    code === "auth/invalid-login-credentials"
  ) {
    return new Error("Password is incorrect.");
  }

  if (code === "auth/too-many-requests") {
    return new Error("Too many login attempts. Try again in a few minutes.");
  }

  if (code === "auth/network-request-failed") {
    return new Error("Check your internet connection and try again.");
  }

  if (error instanceof Error) {
    if (error.message === "Username not found.") {
      return new Error("No account found for this username.");
    }

    if (error.message === "Username is not linked to an email.") {
      return new Error("This username cannot be used for login right now.");
    }

    return error;
  }

  return new Error("Unable to login. Please try again.");
};

const mapAccountDeletionError = (error: unknown) => {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  if (
    code === "auth/wrong-password" ||
    code === "auth/invalid-credential" ||
    code === "auth/invalid-login-credentials"
  ) {
    return new Error("Enter your current password to delete your account.");
  }

  if (code === "auth/requires-recent-login") {
    return new Error("Login again and then retry deleting your account.");
  }

  if (code === "auth/network-request-failed") {
    return new Error("Check your internet connection and try again.");
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Unable to delete your account right now.");
};

const clearGoogleSessionsAsync = async () => {
  if (Platform.OS === "web") {
    return;
  }

  try {
    const googleSignInModule = loadGoogleSignInModule();
    if (!googleSignInModule) {
      return;
    }

    const signOutOperations = [googleSignInModule.GoogleSignin.signOut()];

    if (googleSignInModule.GoogleOneTapSignIn) {
      signOutOperations.push(googleSignInModule.GoogleOneTapSignIn.signOut());
    }

    await Promise.allSettled(signOutOperations);
  } catch {
    // Ignore if Google sign-in is not active on this device/session.
  }
};

const deleteDocumentRefsInChunks = async (
  refs: DocumentReference<DocumentData>[],
) => {
  if (!refs.length) {
    return;
  }

  for (let index = 0; index < refs.length; index += MAX_BATCH_DELETE_COUNT) {
    const batch = writeBatch(firestore);
    refs.slice(index, index + MAX_BATCH_DELETE_COUNT).forEach((ref) => {
      batch.delete(ref);
    });
    await batch.commit();
  }
};

const hasRecentLogin = (currentUser: User) => {
  const lastSignInTime = currentUser.metadata.lastSignInTime;

  if (!lastSignInTime) {
    return false;
  }

  const parsedLastSignInAt = Date.parse(lastSignInTime);

  if (Number.isNaN(parsedLastSignInAt)) {
    return false;
  }

  return Date.now() - parsedLastSignInAt <= RECENT_LOGIN_WINDOW_MS;
};

const writeUserProfile = async (payload: {
  uid: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  accountStatus?: string;
  provider: AuthProviderName;
  displayName?: string | null;
  photoURL?: string | null;
  bio?: string | null;
  gender?: string | null;
}) => {
  const profileRecord = buildUserProfileRecord(payload);
  const usernameRef = doc(firestore, USERNAMES_COLLECTION, profileRecord.usernameLower);
  const userRef = doc(firestore, USERS_COLLECTION, profileRecord.uid);

  await runTransaction(firestore, async (transaction) => {
    const usernameSnapshot = await transaction.get(usernameRef);

    if (usernameSnapshot.exists()) {
      const existingUid = (usernameSnapshot.data() as DocumentData)?.uid;
      if (existingUid && existingUid !== profileRecord.uid) {
        throw new Error("Username is already taken.");
      }
    }

    const persistedProfile = {
      uid: profileRecord.uid,
      username: profileRecord.username,
      usernameLower: profileRecord.usernameLower,
      firstName: profileRecord.firstName,
      lastName: profileRecord.lastName,
      email: profileRecord.email,
      provider: profileRecord.provider,
      displayName: profileRecord.displayName,
      photoURL: profileRecord.photoURL || null,
      bio: profileRecord.bio,
      gender: profileRecord.gender,
      // Keep privileged fields out of client-owned profile sync writes.
      // Role and account status stay admin-controlled.
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    };
    const usernameMapping = {
      uid: profileRecord.uid,
      username: profileRecord.username,
      usernameLower: profileRecord.usernameLower,
      email: profileRecord.email,
      updatedAt: serverTimestamp(),
    };

    if (!usernameSnapshot.exists()) {
      transaction.set(usernameRef, usernameMapping);
    }
    transaction.set(userRef, persistedProfile, { merge: true });
  });
};

const writeExistingFederatedUserProfile = async (payload: {
  uid: string;
  firstName: string;
  lastName: string;
  displayName: string;
  photoURL: string | null;
  bio: string;
  gender: string;
  provider: Exclude<AuthProviderName, "password">;
}) => {
  await setDoc(
    doc(firestore, USERS_COLLECTION, payload.uid),
    {
      firstName: payload.firstName,
      lastName: payload.lastName,
      displayName: payload.displayName,
      photoURL: payload.photoURL,
      bio: payload.bio,
      gender: payload.gender,
      provider: payload.provider,
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const persistFederatedUserProfile = async (payload: {
  authUser: User;
  provider: Exclude<AuthProviderName, "password">;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}) => {
  const { authUser, provider } = payload;
  const existingUserSnapshot = await getDoc(doc(firestore, USERS_COLLECTION, authUser.uid));
  const existingProfile = existingUserSnapshot.exists()
    ? (existingUserSnapshot.data() as DocumentData)
    : null;
  const existingUsername = readStringValue(existingProfile?.username);
  const existingDisplayName = readStringValue(existingProfile?.displayName);
  const existingFirstName = readStringValue(existingProfile?.firstName);
  const existingLastName = readStringValue(existingProfile?.lastName);
  const existingEmail = readStringValue(existingProfile?.email);
  const existingPhotoURL = readStringValue(existingProfile?.photoURL);
  const existingGender = readStringValue(existingProfile?.gender);
  const existingRole = readStringValue(existingProfile?.role);
  const existingAccountStatus = normalizeAccountStatus(
    readStringValue(existingProfile?.accountStatus)
  );

  if (existingAccountStatus === "deleted") {
    await signOut(auth);
    throw new Error("This account has been removed by admin.");
  }

  const effectiveEmail = normalizeEmail(
    pickFirstNonEmptyValue(payload.email, authUser.email, existingEmail)
  );

  if (!effectiveEmail) {
    throw new Error(
      provider === "apple"
        ? "Apple account did not return an email."
        : "Google account did not return an email."
    );
  }

  const baseDisplayName = pickFirstNonEmptyValue(
    payload.displayName,
    authUser.displayName,
    existingDisplayName,
    `${payload.firstName ?? ""} ${payload.lastName ?? ""}`.trim()
  );
  const generatedUsername = baseDisplayName
    ? sanitizeUsername(baseDisplayName)
    : getFallbackUsername(effectiveEmail || null, authUser.uid);
  const candidate =
    existingUsername ||
    generatedUsername ||
    getFallbackUsername(effectiveEmail || null, authUser.uid);
  const { firstName, lastName } = getNameParts(baseDisplayName);
  const effectiveRole = getEffectiveUserRole(existingRole);
  const effectiveFirstName = normalizeName(
    pickFirstNonEmptyValue(payload.firstName, firstName, existingFirstName, candidate)
  );
  const effectiveLastName = normalizeName(
    pickFirstNonEmptyValue(payload.lastName, lastName, existingLastName)
  );
  const effectiveDisplayName =
    normalizeName(
      pickFirstNonEmptyValue(
        payload.displayName,
        baseDisplayName,
        `${effectiveFirstName} ${effectiveLastName}`.trim(),
        candidate
      )
    ) || candidate;
  const effectivePhotoURL =
    normalizePhotoUrl(
      pickFirstNonEmptyValue(payload.photoURL, authUser.photoURL, existingPhotoURL)
    ) || null;
  const existingProfileSyncPayload = {
    uid: authUser.uid,
    firstName: effectiveFirstName,
    lastName: effectiveLastName,
    displayName: effectiveDisplayName,
    photoURL: effectivePhotoURL,
    bio: readStringValue(existingProfile?.bio),
    gender: existingGender,
    provider,
  };

  if (existingUserSnapshot.exists() && existingUsername) {
    await writeExistingFederatedUserProfile(existingProfileSyncPayload);
  } else {
    try {
      await writeUserProfile({
        uid: authUser.uid,
        username: candidate,
        firstName: effectiveFirstName,
        lastName: effectiveLastName,
        email: effectiveEmail,
        role: effectiveRole,
        accountStatus: "active",
        provider,
        displayName: effectiveDisplayName,
        photoURL: effectivePhotoURL,
        bio: existingProfileSyncPayload.bio,
        gender: existingProfileSyncPayload.gender,
      });
    } catch (error) {
      if (existingUsername || !isUsernameTakenError(error)) {
        throw error;
      }

      await writeUserProfile({
        uid: authUser.uid,
        username: ensureUniqueProviderUsername(authUser.uid, effectiveEmail),
        firstName: effectiveFirstName,
        lastName: effectiveLastName,
        email: effectiveEmail,
        role: effectiveRole,
        accountStatus: "active",
        provider,
        displayName: effectiveDisplayName,
        photoURL: effectivePhotoURL,
        bio: existingProfileSyncPayload.bio,
        gender: existingProfileSyncPayload.gender,
      });
    }
  }

  if (
    authUser.displayName !== effectiveDisplayName ||
    normalizePhotoUrl(authUser.photoURL) !== normalizePhotoUrl(effectivePhotoURL)
  ) {
    await updateProfile(authUser, {
      displayName: effectiveDisplayName,
      photoURL: effectivePhotoURL,
    });
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasProfileDocument, setHasProfileDocument] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const role = getEffectiveUserRole(profile?.role);
  const isAdmin = role === "admin";
  const hasActiveAccount = Boolean(user) && (!profile || profile.accountStatus !== "deleted");
  const isProfileBootstrapping = Boolean(user) && profile === null;
  const canManagePosts = hasActiveAccount && canManagePostsForRole(role);
  const canModeratePosts = hasActiveAccount && canModeratePostsForRole(role);
  const canManageUsers = hasActiveAccount && canManageUsersForRole(role);
  const isBootstrapping = !authReady || isProfileBootstrapping;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setProfile(null);
      setHasProfileDocument(false);
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setHasProfileDocument(false);
      return;
    }

    const profileRef = doc(firestore, USERS_COLLECTION, user.uid);
    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setHasProfileDocument(true);
          setProfile(mapUserProfile(user.uid, snapshot.data() as DocumentData));
          return;
        }

        setHasProfileDocument(false);
        setProfile(createFallbackUserProfile(user));
      },
      () => {
        setHasProfileDocument(false);
        setProfile(createFallbackUserProfile(user));
      }
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user || !profile || profile.accountStatus !== "deleted") {
      return;
    }

    void signOut(auth);
  }, [profile, user]);

  const setRememberSessionPersistence = async (remember: boolean) => {
    await setPersistence(auth, getAuthPersistenceForRememberMe(remember));
  };

  const isUsernameAvailable = async (username: string, excludeUid?: string) =>
    isUsernameAvailableRecord(username, excludeUid);

  const doesUsernameLoginIdentifierExist = async (identifier: string) => {
    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier || normalizedIdentifier.includes("@")) {
      return false;
    }

    const usernameSnapshot = await getDoc(
      doc(firestore, USERNAMES_COLLECTION, normalizeUsername(normalizedIdentifier)),
    );
    return usernameSnapshot.exists();
  };

  const loginWithEmailOrUsername = async (identifier: string, password: string) => {
    const normalizedIdentifier = identifier.trim();
    try {
      const identifierLooksLikeEmail = normalizedIdentifier.includes("@");
      let email = "";

      if (identifierLooksLikeEmail) {
        email = normalizeEmail(normalizedIdentifier);
      } else {
        if (!(await doesUsernameLoginIdentifierExist(normalizedIdentifier))) {
          throw new Error("No account found for this username.");
        }

        email = await readUsernameEmail(normalizedIdentifier);
      }

      const credential = await signInWithEmailAndPassword(auth, email, password);
      await ensureAccountIsActive(credential.user.uid);
    } catch (error) {
      if (auth.currentUser) {
        await signOut(auth);
      }

      throw mapLoginError(error, normalizedIdentifier);
    }
  };

  const requestPasswordReset = async (identifier: string) => {
    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier) {
      throw new Error("Enter your email or username first.");
    }

    try {
      const email = normalizedIdentifier.includes("@")
        ? normalizeEmail(normalizedIdentifier)
        : await readUsernameEmail(normalizedIdentifier);

      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw mapPasswordResetError(error);
    }
  };

  const signupWithEmail = async (payload: {
    firstName: string;
    lastName: string;
    email: string;
    username?: string;
    password: string;
  }) => {
    const { firstName, lastName, email, username, password } = payload;
    validateName("First name", firstName);
    validateName("Last name", lastName);
    const normalizedFirstName = normalizeName(firstName);
    const normalizedLastName = normalizeName(lastName);
    const normalizedEmail = normalizeEmail(email);
    const normalizedUsername = normalizeUsername(username ?? "");
    const requestedUsername = normalizedUsername || "";

    if (requestedUsername) {
      validateUsername(requestedUsername);
      if (!(await isUsernameAvailableRecord(requestedUsername))) {
        throw new Error("Username is already taken.");
      }
    }

    let createdUser: User | null = null;

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );
      createdUser = credential.user;
      const generatedUsername =
        requestedUsername || getEmailSignupUsername(normalizedEmail, credential.user.uid);
      validateUsername(generatedUsername);
      const normalizedDisplayName = `${normalizedFirstName} ${normalizedLastName}`.trim();

      await updateProfile(credential.user, {
        displayName: normalizedDisplayName || generatedUsername,
      });
      await writeUserProfile({
        uid: credential.user.uid,
        username: generatedUsername,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        role: getEffectiveUserRole("user"),
        accountStatus: "active",
        provider: "password",
        displayName: normalizedDisplayName || generatedUsername,
        photoURL: null,
      });
    } catch (error) {
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch {
          // Keep the original signup error if cleanup fails.
        }
      }
      throw mapEmailSignupError(error);
    }
  };

  const updateCurrentUserProfile = async (payload: {
    firstName: string;
    lastName: string;
    username: string;
    photoURL: string;
    bio: string;
    gender: string;
  }) => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("You must be logged in to update your profile.");
    }

    validateName("First name", payload.firstName);
    validateUsername(payload.username);

    if (!payload.gender.trim()) {
      throw new Error("Gender is required.");
    }

    if (!payload.bio.trim()) {
      throw new Error("Bio is required.");
    }

    const existingProfile = profile ?? createFallbackUserProfile(currentUser);
    const normalizedEmail = normalizeEmail(existingProfile.email || currentUser.email || "");

    if (!normalizedEmail) {
      throw new Error("Unable to determine your account email.");
    }

    const nextProfile = buildUserProfileRecord({
      uid: currentUser.uid,
      username: payload.username,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: normalizedEmail,
      role: getEffectiveUserRole(existingProfile.role),
      accountStatus: existingProfile.accountStatus,
      provider: existingProfile.provider || resolveProvider(currentUser),
      displayName: `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim(),
      photoURL: payload.photoURL,
      bio: payload.bio,
      gender: payload.gender,
    });

    await runTransaction(firestore, async (transaction) => {
      const userRef = doc(firestore, USERS_COLLECTION, currentUser.uid);
      const nextUsernameRef = doc(
        firestore,
        USERNAMES_COLLECTION,
        nextProfile.usernameLower
      );
      const userSnapshot = await transaction.get(userRef);
      const nextUsernameSnapshot = await transaction.get(nextUsernameRef);
      const dbProfile = userSnapshot.exists()
        ? mapUserProfile(currentUser.uid, userSnapshot.data() as DocumentData)
        : existingProfile;
      const existingUsernameLower =
        dbProfile.usernameLower || normalizeUsername(dbProfile.username);
      const lastLoginAt =
        (userSnapshot.exists() ? (userSnapshot.data() as DocumentData)?.lastLoginAt : null) ??
        serverTimestamp();

      if (nextUsernameSnapshot.exists()) {
        const existingUid = (nextUsernameSnapshot.data() as DocumentData)?.uid;
        if (existingUid && existingUid !== currentUser.uid) {
          throw new Error("Username is already taken.");
        }
      }

      const persistedProfile = {
        ...nextProfile,
        photoURL: nextProfile.photoURL || null,
        updatedAt: serverTimestamp(),
        lastLoginAt,
      };
      const usernameMapping = {
        uid: nextProfile.uid,
        username: nextProfile.username,
        usernameLower: nextProfile.usernameLower,
        email: nextProfile.email,
        updatedAt: serverTimestamp(),
      };

      transaction.set(userRef, persistedProfile, { merge: true });
      if (!nextUsernameSnapshot.exists() || existingUsernameLower !== nextProfile.usernameLower) {
        transaction.set(nextUsernameRef, usernameMapping, { merge: true });
      }

      if (existingUsernameLower && existingUsernameLower !== nextProfile.usernameLower) {
        transaction.delete(doc(firestore, USERNAMES_COLLECTION, existingUsernameLower));
      }
    });

    await updateProfile(currentUser, {
      displayName: nextProfile.displayName,
      photoURL: nextProfile.photoURL || null,
    });
    setProfile(nextProfile);
  };

  const loginWithGoogleIdToken = async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    await persistFederatedUserProfile({
      authUser: result.user,
      provider: "google",
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    });
  };

  const loginWithAppleCredential = async (payload: {
    idToken: string;
    rawNonce: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }) => {
    const provider = new OAuthProvider("apple.com");
    const credential = provider.credential({
      idToken: payload.idToken,
      rawNonce: payload.rawNonce,
    });
    const result = await signInWithCredential(auth, credential);
    await persistFederatedUserProfile({
      authUser: result.user,
      provider: "apple",
      email: payload.email ?? result.user.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      displayName: `${payload.firstName ?? ""} ${payload.lastName ?? ""}`.trim(),
      photoURL: result.user.photoURL,
    });
  };

  const deleteCurrentUserAccount = async (currentPassword?: string) => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("You must be logged in to delete your account.");
    }

    const existingProfile = profile ?? createFallbackUserProfile(currentUser);
    const provider = existingProfile.provider || resolveProvider(currentUser);
    const normalizedEmail = normalizeEmail(existingProfile.email || currentUser.email || "");
    const normalizedPassword = currentPassword?.trim() ?? "";

    try {
      if (provider === "password" && normalizedPassword) {
        if (!normalizedEmail) {
          throw new Error("Unable to determine your account email.");
        }

        await reauthenticateWithCredential(
          currentUser,
          EmailAuthProvider.credential(normalizedEmail, normalizedPassword),
        );
      }

      if (!hasRecentLogin(currentUser)) {
        throw new Error("Login again and then retry deleting your account.");
      }

      const [
        authorFollowersSnapshot,
        authorFollowingSnapshot,
        favoritesSnapshot,
        pushTokensSnapshot,
        notificationsSnapshot,
      ] =
        await Promise.all([
          getDocs(
            query(
              collection(firestore, AUTHOR_FOLLOWS_COLLECTION),
              where("authorId", "==", currentUser.uid),
            ),
          ),
          getDocs(
            query(
              collection(firestore, AUTHOR_FOLLOWS_COLLECTION),
              where("uid", "==", currentUser.uid),
            ),
          ),
          getDocs(
            query(
              collection(firestore, FAVORITES_COLLECTION),
              where("uid", "==", currentUser.uid),
            ),
          ),
          getDocs(
            query(
              collection(firestore, PUSH_TOKENS_COLLECTION),
              where("uid", "==", currentUser.uid),
            ),
          ),
          getDocs(
            collection(
              firestore,
              USERS_COLLECTION,
              currentUser.uid,
              USER_NOTIFICATIONS_SUBCOLLECTION,
            ),
          ),
        ]);

      const authorFollowRefs = [
        ...authorFollowersSnapshot.docs.map((item) => item.ref),
        ...authorFollowingSnapshot.docs.map((item) => item.ref),
      ].filter(
        (ref, index, refs) =>
          refs.findIndex((candidate) => candidate.path === ref.path) === index,
      );

      await Promise.all([
        deleteDocumentRefsInChunks(authorFollowRefs),
        deleteDocumentRefsInChunks(favoritesSnapshot.docs.map((item) => item.ref)),
        deleteDocumentRefsInChunks(pushTokensSnapshot.docs.map((item) => item.ref)),
        deleteDocumentRefsInChunks(notificationsSnapshot.docs.map((item) => item.ref)),
      ]);

      await runTransaction(firestore, async (transaction) => {
        const userRef = doc(firestore, USERS_COLLECTION, currentUser.uid);
        const usernameLower =
          existingProfile.usernameLower || normalizeUsername(existingProfile.username);

        if (usernameLower) {
          transaction.delete(doc(firestore, USERNAMES_COLLECTION, usernameLower));
        }

        transaction.set(
          userRef,
          {
            uid: currentUser.uid,
            username: "",
            usernameLower: "",
            firstName: "",
            lastName: "",
            email: "",
            role: "user",
            accountStatus: "deleted",
            provider,
            displayName: "Deleted User",
            photoURL: null,
            bio: "",
            gender: "",
            updatedAt: serverTimestamp(),
            deletedAt: serverTimestamp(),
            deletedBy: currentUser.uid,
            deletedByEmail: "",
          },
          { merge: true },
        );
      });

      await deleteUser(currentUser);
      await clearGoogleSessionsAsync();
      setProfile(null);
    } catch (error) {
      throw mapAccountDeletionError(error);
    }
  };

  const logout = async () => {
    await clearGoogleSessionsAsync();

    if (auth.currentUser) {
      await signOut(auth);
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    hasProfileDocument,
    role,
    isAdmin,
    canManagePosts,
    canModeratePosts,
    canManageUsers,
    isBootstrapping,
    setRememberSessionPersistence,
    isUsernameAvailable,
    loginWithEmailOrUsername,
    requestPasswordReset,
    signupWithEmail,
    updateCurrentUserProfile,
    loginWithGoogleIdToken,
    loginWithAppleCredential,
    deleteCurrentUserAccount,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
