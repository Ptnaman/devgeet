import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";

import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import {
  USER_ROLES,
  getEffectiveUserRole,
  isAdminEmail,
  normalizeAccountStatus,
  type UserRole,
} from "@/lib/access";
import { firestore } from "@/lib/firebase";
import { getActionErrorMessage, getRequestErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const USERS_COLLECTION = "users";

const ROLE_LABELS: Record<UserRole, string> = {
  user: "User",
  author: "Author",
  admin: "Admin",
};

type ManagedUser = {
  uid: string;
  displayName: string;
  email: string;
  username: string;
  provider: string;
  role: UserRole;
  accountStatus: "active" | "deleted";
};

const readStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const mapManagedUser = (uid: string, data: DocumentData): ManagedUser => {
  const email = readStringValue(data?.email);
  const firstName = readStringValue(data?.firstName);
  const lastName = readStringValue(data?.lastName);
  const displayName =
    readStringValue(data?.displayName) ||
    `${firstName} ${lastName}`.trim() ||
    readStringValue(data?.username) ||
    email ||
    "User";

  return {
    uid,
    displayName,
    email,
    username: readStringValue(data?.username),
    provider: readStringValue(data?.provider) || "password",
    role: getEffectiveUserRole(readStringValue(data?.role), email),
    accountStatus: normalizeAccountStatus(readStringValue(data?.accountStatus)),
  };
};

export default function AdminUsersScreen() {
  const { colors } = useAppTheme();
  const { isConnected } = useNetworkStatus();
  const { isOwner, profile } = useAuth();
  const styles = createStyles(colors);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyUserId, setBusyUserId] = useState("");

  useEffect(() => {
    const usersQuery = query(collection(firestore, USERS_COLLECTION));

    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const nextUsers = snapshot.docs
          .map((item) => mapManagedUser(item.id, item.data() as DocumentData))
          .sort((left, right) => left.displayName.localeCompare(right.displayName));

        setUsers(nextUsers);
        setIsLoading(false);
        setError("");
      },
      (snapshotError) => {
        setIsLoading(false);
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load users.",
          })
        );
      }
    );

    return unsubscribe;
  }, [isConnected]);

  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return users.filter((item) => {
      if (!keyword) {
        return true;
      }

      return [item.displayName, item.email, item.username, item.role, item.provider]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [searchTerm, users]);

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((item) => item.role === "admin").length,
      deleted: users.filter((item) => item.accountStatus === "deleted").length,
    }),
    [users]
  );

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

  const handleRoleUpdate = async (targetUser: ManagedUser, nextRole: UserRole) => {
    try {
      setBusyUserId(targetUser.uid);
      clearFeedback();

      await setDoc(
        doc(firestore, USERS_COLLECTION, targetUser.uid),
        {
          role: nextRole,
          accountStatus: "active",
          deletedAt: null,
          deletedBy: null,
          deletedByEmail: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSuccess(`${targetUser.displayName} is now ${ROLE_LABELS[nextRole]}.`);
    } catch (updateError) {
      setError(
        getActionErrorMessage({
          error: updateError,
          isConnected,
          fallbackMessage: "Unable to update user role.",
        })
      );
    } finally {
      setBusyUserId("");
    }
  };

  const runDeleteUser = async (targetUser: ManagedUser) => {
    try {
      setBusyUserId(targetUser.uid);
      clearFeedback();

      await setDoc(
        doc(firestore, USERS_COLLECTION, targetUser.uid),
        {
          role: "user",
          accountStatus: "deleted",
          deletedAt: serverTimestamp(),
          deletedBy: profile?.uid ?? "",
          deletedByEmail: profile?.email ?? "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSuccess(`${targetUser.displayName} removed from app access.`);
    } catch (deleteError) {
      setError(
        getActionErrorMessage({
          error: deleteError,
          isConnected,
          fallbackMessage: "Unable to delete user.",
        })
      );
    } finally {
      setBusyUserId("");
    }
  };

  const handleDeleteUser = (targetUser: ManagedUser) => {
    Alert.alert(
      "Delete User",
      `Delete ${targetUser.displayName}? This removes app access and hides the account from active users.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void runDeleteUser(targetUser);
          },
        },
      ]
    );
  };

  if (!isOwner) {
    return <Redirect href="/admin" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>User Access</Text>
      <Text style={styles.subtitle}>
        Only owner can view every user and change roles from here.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Users</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Admins</Text>
            <Text style={styles.statValue}>{stats.admins}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Deleted</Text>
            <Text style={styles.statValue}>{stats.deleted}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Find User</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search by name, email, username, role"
            placeholderTextColor={colors.mutedText}
            autoCapitalize="none"
            style={styles.input}
          />
        </View>
        <Text style={styles.resultText}>
          Showing {filteredUsers.length} of {users.length} users
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Users</Text>
        {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        {!isLoading && !filteredUsers.length ? (
          <Text style={styles.emptyText}>No users match the current search.</Text>
        ) : null}

        {filteredUsers.map((managedUser) => {
          const isCurrentUser = managedUser.uid === profile?.uid;
          const isProtectedAdmin = isAdminEmail(managedUser.email);
          const isBusy = busyUserId === managedUser.uid;
          const canEditRole = !isCurrentUser && !isProtectedAdmin && !isBusy;
          const canDeleteUser =
            !isCurrentUser &&
            !isProtectedAdmin &&
            !isBusy &&
            managedUser.accountStatus !== "deleted";

          return (
            <View key={managedUser.uid} style={styles.userCard}>
              <View style={styles.cardHeader}>
                <View style={styles.userMeta}>
                  <Text style={styles.userName}>{managedUser.displayName}</Text>
                  <Text style={styles.userSubtext}>{managedUser.email || "No email"}</Text>
                  <Text style={styles.userSubtext}>
                    @{managedUser.username || "username-missing"} • {managedUser.provider}
                  </Text>
                  <Text style={styles.userSubtext}>
                    Status: {managedUser.accountStatus === "deleted" ? "Deleted" : "Active"}
                  </Text>
                </View>

                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{ROLE_LABELS[managedUser.role]}</Text>
                </View>
              </View>

              {isCurrentUser ? (
                <Text style={styles.helperText}>Your own role and delete access are locked.</Text>
              ) : null}
              {isProtectedAdmin ? (
                <Text style={styles.helperText}>
                  This admin email is protected by app configuration.
                </Text>
              ) : null}
              {managedUser.accountStatus === "deleted" ? (
                <Text style={styles.helperText}>
                  Assign any role to restore this user back into the app.
                </Text>
              ) : null}

              <View style={styles.roleRow}>
                {USER_ROLES.map((role) => {
                  const isActiveRole = managedUser.role === role;

                  return (
                    <Pressable
                      key={role}
                      style={[
                        styles.roleChip,
                        isActiveRole ? styles.roleChipActive : undefined,
                        !canEditRole && styles.buttonDisabled,
                      ]}
                      onPress={() => {
                        if (isActiveRole) {
                          return;
                        }

                        void handleRoleUpdate(managedUser, role);
                      }}
                      disabled={!canEditRole}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          isActiveRole ? styles.roleChipTextActive : undefined,
                        ]}
                      >
                        {ROLE_LABELS[role]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[
                  styles.deleteButton,
                  !canDeleteUser && styles.buttonDisabled,
                ]}
                onPress={() => handleDeleteUser(managedUser)}
                disabled={!canDeleteUser}
              >
                <Text style={styles.deleteButtonText}>
                  {isBusy
                    ? "Updating..."
                    : managedUser.accountStatus === "deleted"
                      ? "Already Deleted"
                      : "Delete User"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      padding: SPACING.xl,
      gap: SPACING.md,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: FONT_SIZE.title,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
    },
    error: {
      color: colors.danger,
      fontSize: 13,
    },
    success: {
      color: colors.success,
      fontSize: 13,
    },
    section: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.sm,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    statsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm,
    },
    statCard: {
      width: "31%",
      minWidth: 96,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: colors.surface,
    },
    statLabel: {
      color: colors.mutedText,
      fontSize: 12,
    },
    statValue: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "700",
      marginTop: 2,
    },
    inputWrap: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.md,
      justifyContent: "center",
    },
    input: {
      color: colors.text,
      fontSize: FONT_SIZE.button,
    },
    resultText: {
      color: colors.mutedText,
      fontSize: 13,
    },
    emptyText: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
    },
    userCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      backgroundColor: colors.surface,
      gap: SPACING.sm,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: SPACING.sm,
    },
    userMeta: {
      flex: 1,
      gap: 3,
    },
    userName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    userSubtext: {
      color: colors.mutedText,
      fontSize: 12,
    },
    roleBadge: {
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: 999,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      backgroundColor: colors.accentSoft,
    },
    roleBadgeText: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    helperText: {
      color: colors.mutedText,
      fontSize: 12,
    },
    roleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm,
    },
    roleChip: {
      flex: 1,
      minWidth: 88,
      minHeight: 42,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.sm,
    },
    roleChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    roleChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    roleChipTextActive: {
      color: colors.primaryText,
    },
    deleteButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    deleteButtonText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: "700",
    },
    buttonDisabled: {
      opacity: 0.55,
    },
  });
