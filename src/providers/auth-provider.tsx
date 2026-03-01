import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";

import { isAdminEmail } from "@/lib/access";
import { auth, firestore } from "@/lib/firebase";

const USERNAMES_COLLECTION = "usernames";
const USERS_COLLECTION = "users";

type AuthContextType = {
  user: User | null;
  isAdmin: boolean;
  isBootstrapping: boolean;
  loginWithEmailOrUsername: (identifier: string, password: string) => Promise<void>;
  signupWithEmail: (payload: {
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
  }) => Promise<void>;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeUsername = (value: string) => value.trim().toLowerCase();
const normalizeName = (value: string) => value.trim();
const normalizeRole = (value: string) => value.trim().toLowerCase();
const sanitizeUsername = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 20);

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

const validateRole = (role: string) => {
  if (!role.trim()) {
    throw new Error("Role is required.");
  }
};

const getFallbackUsername = (email: string | null, uid: string) => {
  const base = email?.split("@")[0] ?? `user_${uid.slice(0, 6)}`;
  const sanitized = sanitizeUsername(base);
  return (sanitized || `user_${uid.slice(0, 6)}`).slice(0, 20);
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

const writeUserProfile = async (payload: {
  uid: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  provider: "password" | "google";
}) => {
  const { uid, username, firstName, lastName, email, role, provider } = payload;
  const usernameLower = normalizeUsername(username);
  const normalizedFirstName = normalizeName(firstName);
  const normalizedLastName = normalizeName(lastName);
  const normalizedRole = normalizeRole(role);
  const usernameRef = doc(firestore, USERNAMES_COLLECTION, usernameLower);
  const usernameSnapshot = await getDoc(usernameRef);

  if (usernameSnapshot.exists()) {
    const existingUid = (usernameSnapshot.data() as DocumentData)?.uid;
    if (existingUid && existingUid !== uid) {
      throw new Error("Username is already taken.");
    }
  }

  await setDoc(
    usernameRef,
    {
      uid,
      username,
      usernameLower,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email,
      role: normalizedRole,
      provider,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(firestore, USERS_COLLECTION, uid),
    {
      uid,
      username,
      usernameLower,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email,
      role: normalizedRole,
      provider,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  const loginWithEmailOrUsername = async (identifier: string, password: string) => {
    const normalizedIdentifier = identifier.trim();
    const email = normalizedIdentifier.includes("@")
      ? normalizeEmail(normalizedIdentifier)
      : await readUsernameEmail(normalizedIdentifier);

    await signInWithEmailAndPassword(auth, email, password);
  };

  const signupWithEmail = async (payload: {
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
  }) => {
    const { username, firstName, lastName, email, password, role } = payload;
    validateUsername(username);
    validateName("First name", firstName);
    validateName("Last name", lastName);
    validateRole(role);
    const normalizedUsername = username.trim();
    const normalizedFirstName = normalizeName(firstName);
    const normalizedLastName = normalizeName(lastName);
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = normalizeRole(role);
    const effectiveRole =
      normalizedRole === "admin" && !isAdminEmail(normalizedEmail)
        ? "user"
        : normalizedRole;

    const usernameRef = doc(
      firestore,
      USERNAMES_COLLECTION,
      normalizeUsername(normalizedUsername)
    );
    const existingUsername = await getDoc(usernameRef);
    if (existingUsername.exists()) {
      throw new Error("Username is already taken.");
    }

    const credential = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      password
    );

    await updateProfile(credential.user, { displayName: normalizedUsername });
    await writeUserProfile({
      uid: credential.user.uid,
      username: normalizedUsername,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email: normalizedEmail,
      role: effectiveRole,
      provider: "password",
    });
  };

  const loginWithGoogleIdToken = async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    const normalizedEmail = normalizeEmail(result.user.email ?? "");

    if (!normalizedEmail) {
      throw new Error("Google account did not return an email.");
    }

    const effectiveRole = isAdminEmail(normalizedEmail) ? "admin" : "user";

    const username = result.user.displayName?.trim()
      ? sanitizeUsername(result.user.displayName)
      : getFallbackUsername(result.user.email, result.user.uid);

    const candidate =
      username || getFallbackUsername(result.user.email, result.user.uid);
    const { firstName, lastName } = getNameParts(result.user.displayName);

    try {
      await writeUserProfile({
        uid: result.user.uid,
        username: candidate,
        firstName: firstName || candidate,
        lastName,
        email: normalizedEmail,
        role: effectiveRole,
        provider: "google",
      });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.toLowerCase().includes("already taken")
      ) {
        throw error;
      }

      await writeUserProfile({
        uid: result.user.uid,
        username: ensureUniqueGoogleUsername(result.user.uid, result.user.email),
        firstName: firstName || candidate,
        lastName,
        email: normalizedEmail,
        role: effectiveRole,
        provider: "google",
      });
    }
  };

  const logout = async () => {
    if (auth.currentUser) {
      await signOut(auth);
    }
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAdmin,
      isBootstrapping: !authReady,
      loginWithEmailOrUsername,
      signupWithEmail,
      loginWithGoogleIdToken,
      logout,
    }),
    [authReady, isAdmin, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}

