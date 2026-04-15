import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { doc, onSnapshot, type DocumentData } from "firebase/firestore";

import { AdminPanelIcon } from "@/components/icons/admin-panel-icon";
import { LockPasswordIcon } from "@/components/icons/lock-password-icon";
import { LogoutActionIcon } from "@/components/icons/logout-action-icon";
import { UserAvatarIcon } from "@/components/icons/user-avatar-icon";
import { VerifiedRoleBadge } from "@/components/verified-role-badge";
import { ArrowRightIcon } from "@/components/icons/arrow-right-icon";
import { RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import {
  AUTHOR_APPLICATIONS_COLLECTION,
  AUTHOR_APPLICATION_STATUS_LABELS,
  mapAuthorApplicationRecord,
  type AuthorApplicationRecord,
} from "@/lib/author-applications";
import { firestore } from "@/lib/firebase";
import {
  DEFAULT_OFFLINE_MESSAGE,
  getActionErrorMessage,
  getRequestErrorMessage,
} from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

type ProfileMenuItem = {
  key: string;
  title: string;
  subtitle?: string;
  value?: string;
  icon?: ReactNode;
  onPress?: () => void | Promise<void>;
  destructive?: boolean;
  disabled?: boolean;
  showChevron?: boolean;
};

function ProfileMenuRow({
  item,
  isLast = false,
}: {
  item: ProfileMenuItem;
  isLast?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isInteractive = Boolean(item.onPress) && !item.disabled;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowDivider,
        pressed && isInteractive && styles.rowPressed,
        item.disabled && styles.rowDisabled,
      ]}
      onPress={item.onPress}
      disabled={!isInteractive}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowMain}>
          {item.icon ? <View style={styles.rowIconWrap}>{item.icon}</View> : null}
          <View style={styles.rowTextWrap}>
            <Text
              style={[
                styles.rowTitle,
                item.destructive && styles.rowTitleDestructive,
              ]}
            >
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={styles.rowSubtitle} numberOfLines={2}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.rowRight}>
          {item.value ? (
            <Text style={styles.rowValue} numberOfLines={1}>
              {item.value}
            </Text>
          ) : null}
          {item.showChevron !== false ? (
            <ArrowRightIcon
              size={20}
              color={item.destructive ? colors.danger : colors.subtleText}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { isConnected, showOfflineToast, showToast } = useNetworkStatus();
  const router = useRouter();
  const {
    canManagePosts,
    isAdmin,
    logout,
    profile,
    role,
    requestPasswordReset,
    user,
  } = useAuth();
  const styles = createStyles(colors);
  const [application, setApplication] = useState<AuthorApplicationRecord | null>(null);
  const [applicationError, setApplicationError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!user?.uid || role !== "user") {
      setApplication(null);
      setApplicationError("");
      return;
    }

    return onSnapshot(
      doc(firestore, AUTHOR_APPLICATIONS_COLLECTION, user.uid),
      (snapshot) => {
        setApplication(
          snapshot.exists()
            ? mapAuthorApplicationRecord(snapshot.id, snapshot.data() as DocumentData)
            : null,
        );
        setApplicationError("");
      },
      (snapshotError) => {
        setApplication(null);
        setApplicationError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load your creator application status.",
          }),
        );
      },
    );
  }, [isConnected, role, user?.uid]);

  if (user && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const accountName =
    `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() ||
    profile?.displayName ||
    user?.displayName ||
    user?.email ||
    "User";
  const avatarUri = profile?.photoURL || user?.photoURL || "";
  const accountInitials =
    accountName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U";
  const accountEmail = profile?.email || user?.email || "No email";
  const creatorStatus = application ? AUTHOR_APPLICATION_STATUS_LABELS[application.status] : "";
  const isPasswordAccount = profile?.provider === "password";
  const hasCompleteAuthorProfile = Boolean(
    profile?.firstName.trim() &&
      profile?.username.trim() &&
      profile?.gender.trim() &&
      profile?.bio.trim(),
  );
  const hasVerifiedAuthorAccount = profile?.provider === "google" || Boolean(user?.emailVerified);
  const needsVerificationForAuthorAccess =
    role === "user" && !canManagePosts && !hasVerifiedAuthorAccount;
  const needsProfileCompletionForAuthorAccess =
    role === "user" && !canManagePosts && !hasCompleteAuthorProfile;
  const passwordProviderLabel =
    profile?.provider === "google"
      ? "Google"
      : profile?.provider === "apple"
        ? "Apple"
        : "your provider";

  const openCreatorAction = () => {
    if (canManagePosts) {
      router.push(isAdmin ? "/admin" : "/admin/posts");
      return;
    }

    router.push("/author-apply");
  };

  const runChangePassword = async () => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    if (!accountEmail || accountEmail === "No email") {
      setPasswordError("Unable to determine your account email.");
      return;
    }

    try {
      setIsSendingPasswordReset(true);
      setPasswordError("");
      await requestPasswordReset(accountEmail);
      showToast("Password reset email sent.");
    } catch (passwordActionError) {
      const message = getActionErrorMessage({
        error: passwordActionError,
        isConnected,
        fallbackMessage: "Unable to send password reset email right now.",
      });

      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
      }

      setPasswordError(message);
    } finally {
      setIsSendingPasswordReset(false);
    }
  };

  const handleChangePassword = () => {
    if (!isPasswordAccount) {
      return;
    }

    Alert.alert(
      "Change Password",
      `A password reset email will be sent to ${accountEmail}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Email",
          onPress: () => {
            void runChangePassword();
          },
        },
      ],
    );
  };

  const runLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      router.replace("/auth-choice");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "You will be signed out from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          onPress: () => {
            void runLogout();
          },
        },
      ],
    );
  };

  const creatorTitle = canManagePosts
    ? isAdmin
      ? "Open Admin Panel"
      : "Open My Posts"
    : application?.status === "pending"
      ? "Author Application"
      : application?.status === "rejected"
        ? "Reapply for Author Access"
        : application?.status === "withdrawn"
          ? "Apply Again for Author Access"
          : "Apply for Author Access";

  const creatorSubtitle = canManagePosts
    ? isAdmin
      ? "Review users, posts, and admin tools"
      : "Create drafts and submit them for approval"
    : application?.status === "pending"
      ? "Your request is under admin review."
      : application?.status === "rejected"
        ? "Your last request was declined. Update it and apply again."
      : application?.status === "withdrawn"
        ? "You withdrew your last request. You can send a fresh one anytime."
        : needsVerificationForAuthorAccess
          ? "Verify your email first, or use Google login, before requesting creator access."
          : needsProfileCompletionForAuthorAccess
            ? "Complete your profile before requesting creator access."
          : "Request creator access to write and submit posts.";
  const canOpenPublicAuthorPage = role === "author" || role === "admin";

  const profileItems: ProfileMenuItem[] = [
    {
      key: "edit-profile",
      title: "Edit Profile",
      subtitle: "Update your name, username, gender, and bio",
      icon: <UserAvatarIcon color={colors.accent} size={18} />,
      onPress: () => router.push("/profile-edit"),
    },
    ...(canOpenPublicAuthorPage
      ? [
          {
            key: "public-profile",
            title: "Public Author Page",
            subtitle: "Open your public profile page",
            value: "Live",
            onPress: user?.uid
              ? () => router.push({ pathname: "/author/[authorId]", params: { authorId: user.uid } })
              : undefined,
          } satisfies ProfileMenuItem,
        ]
      : []),
    {
      key: "email",
      title: "Email Address",
      subtitle: accountEmail,
      icon: <LockPasswordIcon color={colors.iconMuted} size={18} />,
      disabled: true,
      showChevron: false,
    },
  ];

  const securityItems: ProfileMenuItem[] = [
    {
      key: "change-password",
      title: isSendingPasswordReset ? "Sending reset email..." : "Change Password",
      subtitle: isPasswordAccount
        ? "Send a reset email to update your password"
        : `Password is managed by ${passwordProviderLabel}`,
      icon: <LockPasswordIcon color={isPasswordAccount ? colors.accent : colors.iconMuted} size={18} />,
      onPress: isPasswordAccount
        ? () => {
            handleChangePassword();
          }
        : undefined,
      disabled: isSendingPasswordReset || !isPasswordAccount,
      showChevron: false,
    },
  ];

  const sessionItems: ProfileMenuItem[] = [
    {
      key: "logout",
      title: isLoggingOut ? "Logging out..." : "Logout",
      subtitle: "Sign out from this device",
      icon: <LogoutActionIcon color={colors.text} size={18} />,
      onPress: () => {
        void handleLogout();
      },
      disabled: isLoggingOut,
      showChevron: false,
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{accountInitials}</Text>
          )}
        </View>

        <View style={styles.profileTextWrap}>
          <View style={styles.profileNameRow}>
            <Text style={styles.profileName} numberOfLines={1}>
              {accountName}
            </Text>
            <VerifiedRoleBadge role={role} />
          </View>
          <Text style={styles.profileSubtitle} numberOfLines={1}>
            {accountEmail}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Profile</Text>
      <View style={styles.groupCard}>
        {profileItems.map((item, index) => (
          <ProfileMenuRow
            key={item.key}
            item={item}
            isLast={index === profileItems.length - 1}
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Creator</Text>
      <View style={styles.groupCard}>
        <ProfileMenuRow
          item={{
            key: "creator",
            title: creatorTitle,
            subtitle: creatorSubtitle,
            value: !canManagePosts && creatorStatus ? creatorStatus : undefined,
            icon: <AdminPanelIcon color={colors.accent} size={18} />,
            onPress: openCreatorAction,
          }}
          isLast
        />
      </View>
      {applicationError ? <Text style={styles.helperError}>{applicationError}</Text> : null}

      <Text style={styles.sectionLabel}>Security</Text>
      <View style={styles.groupCard}>
        {securityItems.map((item, index) => (
          <ProfileMenuRow
            key={item.key}
            item={item}
            isLast={index === securityItems.length - 1}
          />
        ))}
      </View>
      {passwordError ? <Text style={styles.helperError}>{passwordError}</Text> : null}

      <Text style={styles.sectionLabel}>Session</Text>
      <View style={styles.groupCard}>
        {sessionItems.map((item, index) => (
          <ProfileMenuRow
            key={item.key}
            item={item}
            isLast={index === sessionItems.length - 1}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      padding: SPACING.xxl,
      paddingBottom: SPACING.xxl * 2,
      gap: SPACING.md,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.card,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...SHADOWS.sm,
    },
    avatarWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    avatarText: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    profileTextWrap: {
      flex: 1,
      gap: 3,
    },
    profileNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    profileName: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
      flexShrink: 1,
    },
    profileSubtitle: {
      color: colors.mutedText,
      fontSize: 12,
    },
    sectionLabel: {
      paddingHorizontal: 2,
      color: colors.mutedText,
      fontSize: 14,
      fontWeight: "500",
    },
    groupCard: {
      borderRadius: RADIUS.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      ...SHADOWS.sm,
    },
    row: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      backgroundColor: colors.surface,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    rowPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    rowDisabled: {
      opacity: 0.62,
    },
    rowContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
    },
    rowMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    rowIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    rowTextWrap: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    rowTitleDestructive: {
      color: colors.danger,
    },
    rowSubtitle: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 16,
    },
    rowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      maxWidth: "42%",
    },
    rowValue: {
      color: colors.subtleText,
      fontSize: 15,
    },
    helperError: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 19,
      paddingHorizontal: 2,
    },
  });
