import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";

import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
  type ThemeMode,
} from "@/constants/theme";
import {
  AUTHOR_APPLICATIONS_COLLECTION,
  AUTHOR_APPLICATION_STATUS_LABELS,
  mapAuthorApplicationRecord,
  type AuthorApplicationRecord,
} from "@/lib/author-applications";
import { getEffectiveUserRole, normalizeAccountStatus } from "@/lib/access";
import { formatDate } from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { getActionErrorMessage, getRequestErrorMessage } from "@/lib/network";
import { createCustomUserNotificationAsync } from "@/lib/user-notifications";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const USERS_COLLECTION = "users";

export default function AdminAuthorApplicationsScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { isConnected, showOfflineToast, showToast } = useNetworkStatus();
  const { isAdmin, profile } = useAuth();
  const styles = createStyles(colors, resolvedTheme);
  const [applications, setApplications] = useState<AuthorApplicationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyUid, setBusyUid] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const applicationsQuery = query(
      collection(firestore, AUTHOR_APPLICATIONS_COLLECTION),
      orderBy("updatedAt", "desc"),
    );

    return onSnapshot(
      applicationsQuery,
      (snapshot) => {
        setApplications(
          snapshot.docs.map((item) =>
            mapAuthorApplicationRecord(item.id, item.data() as DocumentData),
          ),
        );
        setError("");
        setIsLoading(false);
      },
      (snapshotError) => {
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load author applications.",
          }),
        );
        setIsLoading(false);
      },
    );
  }, [isAdmin, isConnected]);

  const stats = useMemo(
    () => ({
      total: applications.length,
      pending: applications.filter((item) => item.status === "pending").length,
      approved: applications.filter((item) => item.status === "approved").length,
      rejected: applications.filter((item) => item.status === "rejected").length,
    }),
    [applications],
  );

  const pendingApplications = useMemo(
    () => applications.filter((item) => item.status === "pending"),
    [applications],
  );
  const reviewedApplications = useMemo(
    () => applications.filter((item) => item.status !== "pending"),
    [applications],
  );

  if (!isAdmin) {
    return <Redirect href="/admin" />;
  }

  const approveApplication = async (target: AuthorApplicationRecord) => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    try {
      setBusyUid(target.uid);
      setError("");

      await runTransaction(firestore, async (transaction) => {
        const applicationRef = doc(firestore, AUTHOR_APPLICATIONS_COLLECTION, target.uid);
        const userRef = doc(firestore, USERS_COLLECTION, target.uid);
        const [applicationSnapshot, userSnapshot] = await Promise.all([
          transaction.get(applicationRef),
          transaction.get(userRef),
        ]);

        if (!applicationSnapshot.exists()) {
          throw new Error("This application is no longer available.");
        }

        if (!userSnapshot.exists()) {
          throw new Error("User profile is missing.");
        }

        const applicationData = applicationSnapshot.data() as DocumentData;
        const userData = userSnapshot.data() as DocumentData;
        const applicationStatus =
          typeof applicationData?.status === "string" ? applicationData.status.trim().toLowerCase() : "";
        const userRole = getEffectiveUserRole(
          typeof userData?.role === "string" ? userData.role : "",
        );
        const accountStatus = normalizeAccountStatus(
          typeof userData?.accountStatus === "string" ? userData.accountStatus : "",
        );

        if (applicationStatus !== "pending") {
          throw new Error("Only pending requests can be approved.");
        }

        if (accountStatus === "deleted") {
          throw new Error("Deleted users cannot receive author access.");
        }

        if (userRole === "admin") {
          throw new Error("Admin accounts do not need author approval.");
        }

        if (userRole === "user") {
          transaction.set(
            userRef,
            {
              role: "author",
              accountStatus: "active",
              deletedAt: null,
              deletedBy: null,
              deletedByEmail: null,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }

        transaction.set(
          applicationRef,
          {
            status: "approved",
            reviewedAt: serverTimestamp(),
            reviewedBy: profile?.uid ?? "",
            reviewedByEmail: profile?.email ?? "",
            rejectionReason: "",
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });

      await createCustomUserNotificationAsync({
        uid: target.uid,
        title: "Author access approved",
        body: "Your creator request was approved. You can now open My Posts and submit drafts for review.",
        category: "creator",
      }).catch((notificationError) => {
        console.warn("Unable to save author approval notification.", notificationError);
        showToast("Author access approved. Notification could not be delivered.");
      });

      showToast(`${target.displayName} is now an author.`);
    } catch (actionError) {
      setError(
        getActionErrorMessage({
          error: actionError,
          isConnected,
          fallbackMessage: "Unable to approve this author request.",
        }),
      );
    } finally {
      setBusyUid("");
    }
  };

  const rejectApplication = async (target: AuthorApplicationRecord) => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    try {
      setBusyUid(target.uid);
      setError("");

      await runTransaction(firestore, async (transaction) => {
        const applicationRef = doc(firestore, AUTHOR_APPLICATIONS_COLLECTION, target.uid);
        const applicationSnapshot = await transaction.get(applicationRef);

        if (!applicationSnapshot.exists()) {
          throw new Error("This application is no longer available.");
        }

        const applicationData = applicationSnapshot.data() as DocumentData;
        const applicationStatus =
          typeof applicationData?.status === "string" ? applicationData.status.trim().toLowerCase() : "";

        if (applicationStatus !== "pending") {
          throw new Error("Only pending requests can be rejected.");
        }

        transaction.set(
          applicationRef,
          {
            status: "rejected",
            reviewedAt: serverTimestamp(),
            reviewedBy: profile?.uid ?? "",
            reviewedByEmail: profile?.email ?? "",
            rejectionReason: "",
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });

      await createCustomUserNotificationAsync({
        uid: target.uid,
        title: "Author application update",
        body: "Your creator request was not approved yet. Update your profile or verification status and apply again from Settings.",
        category: "creator",
      }).catch((notificationError) => {
        console.warn("Unable to save author rejection notification.", notificationError);
        showToast("Application rejected. Notification could not be delivered.");
      });

      showToast(`${target.displayName}'s request was rejected.`);
    } catch (actionError) {
      setError(
        getActionErrorMessage({
          error: actionError,
          isConnected,
          fallbackMessage: "Unable to reject this author request.",
        }),
      );
    } finally {
      setBusyUid("");
    }
  };

  const handleApprove = (target: AuthorApplicationRecord) => {
    Alert.alert(
      "Approve Author",
      `Approve ${target.displayName} for creator access?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => {
            void approveApplication(target);
          },
        },
      ],
    );
  };

  const handleReject = (target: AuthorApplicationRecord) => {
    Alert.alert(
      "Reject Application",
      `Reject ${target.displayName}'s creator request?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () => {
            void rejectApplication(target);
          },
        },
      ],
    );
  };

  const getStatusBadgeStyle = (status: AuthorApplicationRecord["status"]) => [
    styles.statusBadge,
    status === "approved"
      ? styles.statusBadgeApproved
      : status === "rejected"
        ? styles.statusBadgeRejected
        : status === "withdrawn"
          ? styles.statusBadgeWithdrawn
          : styles.statusBadgePending,
  ];

  const getStatusBadgeTextStyle = (status: AuthorApplicationRecord["status"]) => [
    styles.statusBadgeText,
    status === "approved"
      ? styles.statusBadgeTextApproved
      : status === "rejected"
        ? styles.statusBadgeTextRejected
        : status === "withdrawn"
          ? styles.statusBadgeTextWithdrawn
          : styles.statusBadgeTextPending,
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Author Applications</Text>
      <Text style={styles.subtitle}>
        Review user requests before author access unlocks in the Creator section.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.sectionDivider} />
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={styles.statValue}>{stats.pending}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Approved</Text>
            <Text style={styles.statValue}>{stats.approved}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Rejected</Text>
            <Text style={styles.statValue}>{stats.rejected}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending Review</Text>
        <View style={styles.sectionDivider} />
        {!isLoading && !pendingApplications.length ? (
          <Text style={styles.emptyText}>No pending author applications right now.</Text>
        ) : null}

        {pendingApplications.map((application) => {
          const isBusy = busyUid === application.uid;

          return (
            <View key={application.uid} style={styles.applicationCard}>
              <View style={styles.applicationHeader}>
                <View style={styles.applicationMeta}>
                  <Text style={styles.applicationName}>{application.displayName}</Text>
                  <Text style={styles.applicationSubtext}>
                    {application.email || `@${application.username || "unknown"}`}
                  </Text>
                  <Text style={styles.applicationSubtext}>
                    Requested {formatDate(application.requestedAt)}
                  </Text>
                </View>
                <View style={getStatusBadgeStyle(application.status)}>
                  <Text style={getStatusBadgeTextStyle(application.status)}>
                    {AUTHOR_APPLICATION_STATUS_LABELS[application.status]}
                  </Text>
                </View>
              </View>

              <View style={styles.copyBlock}>
                <Text style={styles.copyLabel}>Bio</Text>
                <Text style={styles.copyText}>{application.bio || "-"}</Text>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  style={[
                    styles.secondaryButton,
                    isBusy && styles.buttonDisabled,
                  ]}
                  onPress={() => handleReject(application)}
                  disabled={isBusy}
                >
                  <Text style={styles.secondaryButtonText}>
                    {isBusy ? "Updating..." : "Reject"}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.primaryButton,
                    isBusy && styles.buttonDisabled,
                  ]}
                  onPress={() => handleApprove(application)}
                  disabled={isBusy}
                >
                  <Text style={styles.primaryButtonText}>
                    {isBusy ? "Updating..." : "Approve"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>History</Text>
        <View style={styles.sectionDivider} />
        {!isLoading && !reviewedApplications.length ? (
          <Text style={styles.emptyText}>No reviewed applications yet.</Text>
        ) : null}

        {reviewedApplications.map((application) => (
          <View key={application.uid} style={styles.applicationCard}>
            <View style={styles.applicationHeader}>
              <View style={styles.applicationMeta}>
                <Text style={styles.applicationName}>{application.displayName}</Text>
                <Text style={styles.applicationSubtext}>
                  {application.email || `@${application.username || "unknown"}`}
                </Text>
                <Text style={styles.applicationSubtext}>
                  {application.reviewedAt
                    ? `Reviewed ${formatDate(application.reviewedAt)}`
                    : `Updated ${formatDate(application.updatedAt)}`}
                </Text>
              </View>
              <View style={getStatusBadgeStyle(application.status)}>
                <Text style={getStatusBadgeTextStyle(application.status)}>
                  {AUTHOR_APPLICATION_STATUS_LABELS[application.status]}
                </Text>
              </View>
            </View>

            <View style={styles.copyBlock}>
              <Text style={styles.copyLabel}>Bio</Text>
              <Text style={styles.copyText}>{application.bio || "-"}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, resolvedTheme: ThemeMode) => {
  const outlineColor = resolvedTheme === "dark" ? colors.divider : colors.border;

  return StyleSheet.create({
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
      lineHeight: 20,
    },
    error: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 19,
    },
    section: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.sm,
      ...SHADOWS.sm,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    sectionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.divider,
    },
    statsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm,
    },
    statCard: {
      width: "48%",
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: colors.surfaceMuted,
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
    emptyText: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
    },
    applicationCard: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      gap: SPACING.sm,
    },
    applicationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: SPACING.sm,
    },
    applicationMeta: {
      flex: 1,
      gap: 2,
    },
    applicationName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    applicationSubtext: {
      color: colors.mutedText,
      fontSize: 12,
    },
    statusBadge: {
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
    },
    statusBadgePending: {
      borderColor: colors.warningBorder,
      backgroundColor: colors.warningSoft,
    },
    statusBadgeApproved: {
      borderColor: colors.successBorder,
      backgroundColor: colors.successSoft,
    },
    statusBadgeRejected: {
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
    },
    statusBadgeWithdrawn: {
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    statusBadgeTextPending: {
      color: colors.warning,
    },
    statusBadgeTextApproved: {
      color: colors.success,
    },
    statusBadgeTextRejected: {
      color: colors.danger,
    },
    statusBadgeTextWithdrawn: {
      color: colors.mutedText,
    },
    copyBlock: {
      gap: 4,
    },
    copyLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    copyText: {
      color: colors.text,
      fontSize: FONT_SIZE.body,
      lineHeight: 20,
    },
    actionRow: {
      flexDirection: "row",
      gap: SPACING.sm,
      marginTop: SPACING.xs,
    },
    primaryButton: {
      flex: 1,
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    primaryButtonText: {
      color: colors.primaryText,
      fontSize: 14,
      fontWeight: "700",
    },
    secondaryButton: {
      flex: 1,
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    secondaryButtonText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: "700",
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
};
