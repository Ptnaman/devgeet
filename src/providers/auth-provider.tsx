import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { Platform } from "react-native";
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";

import { isAdminEmail } from "@/lib/access";
import { auth, firestore } from "@/lib/firebase";
import { loadGoogleSignInModule } from "@/lib/google-signin-loader";

const USERNAMES_COLLECTION = "usernames";
const USERS_COLLECTION = "users";
type UserProfile = {
  uid: string;
  username: string;
  usernameLower: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  provider: string;
  displayName: string;
  photoURL: string;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isBootstrapping: boolean;
  loginWithEmailOrUsername: (identifier: string, password: string) => Promise<void>;
  requestPasswordReset: (identifier: string) => Promise<void>;
  signupWithEmail: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  updateCurrentUserProfile: (payload: {
    firstName: string;
    lastName: string;
    username: string;
  }) => Promise<void>;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeUsername = (value: string) => value.trim().toLowerCase();
const normalizeName = (value: string) => value.trim();
const normalizeRole = (value: string) => value.trim().toLowerCase();
const normalizePhotoUrl = (value: string | null | undefined) => value?.trim() ?? "";
const sanitizeUsername = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 20);
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

const validateUsername = (username: string) => {
  const candidate = username.trim();
  const isValid = /^[a-zA-Z0-9._-]{3,20}$/.test(candidate);
  if (!isValid) {
    throw new Error(
      "Username must be 3-20 chars and can use letters, numbers, dot, underscore, hyphen."
    );
  }
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

const ensureUniqueGoogleUsername = (uid: string, email: string | null) => {
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
  currentUser?.providerData.some((item) => item.providerId === "google.com")
    ? "google"
    : "password";

const buildUserProfileRecord = (payload: {
  uid: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  provider: string;
  displayName?: string | null;
  photoURL?: string | null;
}): UserProfile => {
  const normalizedUsername = payload.username.trim();
  const usernameLower = normalizeUsername(normalizedUsername);
  const normalizedFirstName = normalizeName(payload.firstName);
  const normalizedLastName = normalizeName(payload.lastName);
  const normalizedEmail = normalizeEmail(payload.email);
  const normalizedRole = normalizeRole(payload.role);
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
    role: normalizedRole,
    provider: normalizedProvider,
    displayName: normalizedDisplayName,
    photoURL: normalizePhotoUrl(payload.photoURL),
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
    role: isAdminEmail(normalizedEmail) ? "admin" : "user",
    provider: resolveProvider(currentUser),
    displayName: currentUser.displayName,
    photoURL: currentUser.photoURL,
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
    provider: readStringValue(data?.provider) || "password",
    displayName: readStringValue(data?.displayName),
    photoURL: readStringValue(data?.photoURL),
  });
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

const writeUserProfile = async (payload: {
  uid: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  provider: "password" | "google";
  displayName?: string | null;
  photoURL?: string | null;
}) => {
  const profileRecord = buildUserProfileRecord(payload);
  const usernameRef = doc(firestore, USERNAMES_COLLECTION, profileRecord.usernameLower);
  const usernameSnapshot = await getDoc(usernameRef);

  if (usernameSnapshot.exists()) {
    const existingUid = (usernameSnapshot.data() as DocumentData)?.uid;
    if (existingUid && existingUid !== profileRecord.uid) {
      throw new Error("Username is already taken.");
    }
  }

  const persistedProfile = {
    ...profileRecord,
    photoURL: profileRecord.photoURL || null,
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  await setDoc(
    usernameRef,
    persistedProfile,
    { merge: true }
  );

  await setDoc(
    doc(firestore, USERS_COLLECTION, profileRecord.uid),
    persistedProfile,
    { merge: true }
  );
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
      }
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const profileRef = doc(firestore, USERS_COLLECTION, user.uid);
    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setProfile(mapUserProfile(user.uid, snapshot.data() as DocumentData));
          return;
        }

        setProfile(createFallbackUserProfile(user));
      },
      () => {
        setProfile(createFallbackUserProfile(user));
      }
    );

    return unsubscribe;
  }, [user]);

  const loginWithEmailOrUsername = async (identifier: string, password: string) => {
    const normalizedIdentifier = identifier.trim();
    const email = normalizedIdentifier.includes("@")
      ? normalizeEmail(normalizedIdentifier)
      : await readUsernameEmail(normalizedIdentifier);

    await signInWithEmailAndPassword(auth, email, password);
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
    password: string;
  }) => {
    const { firstName, lastName, email, password } = payload;
    validateName("First name", firstName);
    validateName("Last name", lastName);
    const normalizedFirstName = normalizeName(firstName);
    const normalizedLastName = normalizeName(lastName);
    const normalizedEmail = normalizeEmail(email);

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );
      const generatedUsername = getEmailSignupUsername(normalizedEmail, credential.user.uid);
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
        role: "user",
        provider: "password",
        displayName: normalizedDisplayName || generatedUsername,
        photoURL: null,
      });
    } catch (error) {
      throw mapEmailSignupError(error);
    }
  };

  const updateCurrentUserProfile = async (payload: {
    firstName: string;
    lastName: string;
    username: string;
  }) => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("You must be logged in to update your profile.");
    }

    validateName("First name", payload.firstName);
    validateName("Last name", payload.lastName);
    validateUsername(payload.username);

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
      role: existingProfile.role || (isAdminEmail(normalizedEmail) ? "admin" : "user"),
      provider: existingProfile.provider || resolveProvider(currentUser),
      displayName: `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim(),
      photoURL: currentUser.photoURL ?? existingProfile.photoURL,
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

      transaction.set(userRef, persistedProfile, { merge: true });
      transaction.set(nextUsernameRef, persistedProfile, { merge: true });

      if (existingUsernameLower && existingUsernameLower !== nextProfile.usernameLower) {
        transaction.delete(doc(firestore, USERNAMES_COLLECTION, existingUsernameLower));
      }
    });

    await updateProfile(currentUser, {
      displayName: nextProfile.displayName,
    });
    setProfile(nextProfile);
  };

  const persistGoogleUserProfile = async (googleUser: User) => {
    const normalizedEmail = normalizeEmail(googleUser.email ?? "");

    if (!normalizedEmail) {
      throw new Error("Google account did not return an email.");
    }

    const existingUserSnapshot = await getDoc(doc(firestore, USERS_COLLECTION, googleUser.uid));
    const existingProfile = existingUserSnapshot.exists()
      ? (existingUserSnapshot.data() as DocumentData)
      : null;

    const existingUsername = readStringValue(existingProfile?.username);
    const generatedUsername = googleUser.displayName?.trim()
      ? sanitizeUsername(googleUser.displayName)
      : getFallbackUsername(googleUser.email, googleUser.uid);
    const candidate =
      existingUsername ||
      generatedUsername ||
      getFallbackUsername(googleUser.email, googleUser.uid);

    const { firstName, lastName } = getNameParts(googleUser.displayName);
    const existingFirstName = readStringValue(existingProfile?.firstName);
    const existingLastName = readStringValue(existingProfile?.lastName);
    const existingRole = normalizeRole(readStringValue(existingProfile?.role));
    const effectiveRole = existingRole || (isAdminEmail(normalizedEmail) ? "admin" : "user");
    const effectiveFirstName = normalizeName(firstName || existingFirstName || candidate);
    const effectiveLastName = normalizeName(lastName || existingLastName);
    const effectiveDisplayName =
      normalizeName(
        googleUser.displayName ?? `${effectiveFirstName} ${effectiveLastName}`.trim()
      ) || candidate;

    try {
      await writeUserProfile({
        uid: googleUser.uid,
        username: candidate,
        firstName: effectiveFirstName,
        lastName: effectiveLastName,
        email: normalizedEmail,
        role: effectiveRole,
        provider: "google",
        displayName: effectiveDisplayName,
        photoURL: googleUser.photoURL,
      });
    } catch (error) {
      if (existingUsername || !isUsernameTakenError(error)) {
        throw error;
      }

      await writeUserProfile({
        uid: googleUser.uid,
        username: ensureUniqueGoogleUsername(googleUser.uid, googleUser.email),
        firstName: effectiveFirstName,
        lastName: effectiveLastName,
        email: normalizedEmail,
        role: effectiveRole,
        provider: "google",
        displayName: effectiveDisplayName,
        photoURL: googleUser.photoURL,
      });
    }
  };

  const loginWithGoogleIdToken = async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    await persistGoogleUserProfile(result.user);
  };

  const logout = async () => {
    if (Platform.OS !== "web") {
      try {
        const googleSignInModule = loadGoogleSignInModule();
        if (googleSignInModule) {
          const signOutOperations = [googleSignInModule.GoogleSignin.signOut()];

          if (googleSignInModule.GoogleOneTapSignIn) {
            signOutOperations.push(googleSignInModule.GoogleOneTapSignIn.signOut());
          }

          await Promise.allSettled(signOutOperations);
        }
      } catch {
        // Ignore if Google sign-in is not active on this device/session.
      }
    }

    if (auth.currentUser) {
      await signOut(auth);
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    isAdmin,
    isBootstrapping: !authReady,
    loginWithEmailOrUsername,
    requestPasswordReset,
    signupWithEmail,
    updateCurrentUserProfile,
    loginWithGoogleIdToken,
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
