import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { reload } from "firebase/auth";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import Svg, { Path } from "react-native-svg";

import { AppScreenLoader } from "@/components/app-screen-loader";
import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import {
  AUTHOR_APPLICATIONS_COLLECTION,
  AUTHOR_APPLICATION_STATUS_LABELS,
  mapAuthorApplicationRecord,
  type AuthorApplicationRecord,
} from "@/lib/author-applications";
import { auth, firestore } from "@/lib/firebase";
import { getActionErrorMessage, getRequestErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const USERS_COLLECTION = "users";

const normalizeProfileValue = (value: string | null | undefined) => value?.trim() ?? "";

type RequirementStatusIconProps = {
  colors: ThemeColors;
  completed: boolean;
  size?: number;
};

function RequirementStatusIcon({
  colors,
  completed,
  size = 20,
}: RequirementStatusIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
        fill={completed ? colors.successSoft : colors.dangerSoft}
        stroke={completed ? colors.successBorder : colors.dangerBorder}
        strokeWidth={1.2}
      />
      {completed ? (
        <Path
          d="M6.25 10.2L8.55 12.5L13.75 7.3"
          stroke={colors.success}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <Path
            d="M7 7L13 13"
            stroke={colors.danger}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Path
            d="M13 7L7 13"
            stroke={colors.danger}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}

export default function AuthorApplyScreen() {
  const { colors } = useAppTheme();
  const { isConnected, showOfflineToast, showToast } = useNetworkStatus();
  const { isBootstrapping, profile, role, user } = useAuth();
  const router = useRouter();
  const styles = createStyles(colors);
  const [application, setApplication] = useState<AuthorApplicationRecord | null>(null);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isLoadingApplication, setIsLoadingApplication] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(Boolean(user?.emailVerified));

  useEffect(() => {
    if (!user?.uid) {
      setApplication(null);
      setIsLoadingApplication(false);
      return;
    }

    return onSnapshot(
      doc(firestore, AUTHOR_APPLICATIONS_COLLECTION, user.uid),
      (snapshot) => {
        const nextApplication = snapshot.exists()
          ? mapAuthorApplicationRecord(snapshot.id, snapshot.data() as DocumentData)
          : null;

        setApplication(nextApplication);
        setLoadError("");
        setIsLoadingApplication(false);
      },
      (snapshotError) => {
        setApplication(null);
        setLoadError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load your author application.",
          }),
        );
        setIsLoadingApplication(false);
      },
    );
  }, [isConnected, user?.uid]);

  useEffect(() => {
    setIsEmailVerified(Boolean(user?.emailVerified));
  }, [user?.emailVerified, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      const syncVerificationState = async () => {
        if (!user) {
          if (!isCancelled) {
            setIsEmailVerified(false);
          }
          return;
        }

        if (profile?.provider === "google") {
          if (!isCancelled) {
            setIsEmailVerified(true);
          }
          return;
        }

        const currentUser = auth.currentUser;

        if (!currentUser) {
          if (!isCancelled) {
            setIsEmailVerified(false);
          }
          return;
        }

        try {
          await reload(currentUser);
          await currentUser.getIdToken(true);
        } catch {
          // Keep the last known verification state if refresh fails.
        }

        if (!isCancelled) {
          setIsEmailVerified(Boolean(auth.currentUser?.emailVerified ?? currentUser.emailVerified));
        }
      };

      void syncVerificationState();

      return () => {
        isCancelled = true;
      };
    }, [profile?.provider, user]),
  );

  if (isBootstrapping || (user && !profile)) {
    return <AppScreenLoader backgroundColor={colors.background} indicatorColor={colors.primary} />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (role !== "user") {
    return <Redirect href="/settings" />;
  }

  const isPending = application?.status === "pending";
  const isRejected = application?.status === "rejected";
  const isWithdrawn = application?.status === "withdrawn";
  const normalizedBio = normalizeProfileValue(profile?.bio);
  const normalizedGender = normalizeProfileValue(profile?.gender);
  const isGoogleLogin = profile?.provider === "google";
  const hasCompleteProfile = Boolean(
    normalizeProfileValue(profile?.firstName) &&
      normalizeProfileValue(profile?.username) &&
      normalizedGender &&
      normalizedBio,
  );
  const hasVerificationReady = isGoogleLogin || isEmailVerified;
  const canSubmitForApproval = hasCompleteProfile && hasVerificationReady;
  const requirementItems = [
    {
      key: "complete-profile",
      label: "Complete your profile",
      satisfied: hasCompleteProfile,
      detail: hasCompleteProfile
        ? "First name, username, gender, and bio are ready."
        : "Complete first name, username, gender, and bio in Edit Profile.",
    },
    {
      key: "verification",
      label: "Google login or verified email",
      satisfied: hasVerificationReady,
      detail: isGoogleLogin
        ? "Google login is already accepted for author access."
        : hasVerificationReady
          ? "Your account email is verified."
          : "Open the verification page and verify your email first.",
    },
  ] as const;

  const submitApplication = async () => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    setSubmitError("");

    if (!hasCompleteProfile) {
      setSubmitError("Complete your profile before applying for author access.");
      return;
    }

    if (!hasVerificationReady) {
      setSubmitError("Verify your email before applying for author access.");
      return;
    }

    try {
      setIsSubmitting(true);

      const batch = writeBatch(firestore);
      batch.set(
        doc(firestore, USERS_COLLECTION, user.uid),
        {
          bio: normalizedBio,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      batch.set(
        doc(firestore, AUTHOR_APPLICATIONS_COLLECTION, user.uid),
        {
          uid: user.uid,
          displayName: profile?.displayName || user.displayName || profile?.username || user.email || "User",
          email: profile?.email || user.email || "",
          username: profile?.username || "",
          bio: normalizedBio,
          reason: "",
          sampleTopicOrLink: "",
          status: "pending",
          requestedAt: serverTimestamp(),
          reviewedAt: null,
          reviewedBy: "",
          reviewedByEmail: "",
          rejectionReason: "",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await batch.commit();

      showToast(
        application ? "Author application updated and sent for review." : "Author application submitted.",
      );
    } catch (error) {
      setSubmitError(
        getActionErrorMessage({
          error,
          isConnected,
          fallbackMessage: "Unable to submit your author application.",
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const withdrawApplication = async () => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");

      await setDoc(
        doc(firestore, AUTHOR_APPLICATIONS_COLLECTION, user.uid),
        {
          status: "withdrawn",
          reviewedAt: null,
          reviewedBy: "",
          reviewedByEmail: "",
          rejectionReason: "",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      showToast("Author application withdrawn.");
    } catch (error) {
      setSubmitError(
        getActionErrorMessage({
          error,
          isConnected,
          fallbackMessage: "Unable to withdraw your author application.",
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = () => {
    Alert.alert(
      "Withdraw Application",
      "Your author request will be removed from the pending review queue.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: () => {
            void withdrawApplication();
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Author Access</Text>
      <Text style={styles.subtitle}>
        Meet both conditions below and then send your request for admin review.
      </Text>

      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <View
        style={[
          styles.statusCard,
          isPending
            ? styles.statusCardPending
            : isRejected
              ? styles.statusCardRejected
              : isWithdrawn
                ? styles.statusCardWithdrawn
                : undefined,
        ]}
      >
        <Text style={styles.statusLabel}>
          {application ? AUTHOR_APPLICATION_STATUS_LABELS[application.status] : "Not Submitted"}
        </Text>
        <Text style={styles.statusText}>
          {isPending
            ? "Your request is pending. You can withdraw it while the admin review is in progress."
            : isRejected
              ? "Your last request was declined. Update your details and apply again."
              : isWithdrawn
                ? "Your last request was withdrawn. You can send a fresh application anytime."
                : "You do not have a pending author request yet."}
        </Text>
      </View>

      {isLoadingApplication ? (
        <View style={styles.section}>
          <Text style={styles.helperText}>Loading your current application...</Text>
        </View>
      ) : null}

      {!isLoadingApplication && isPending ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Request</Text>
          <Text style={styles.helperText}>
            Your current profile details were attached when you submitted this request.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
              isSubmitting && styles.buttonDisabled,
            ]}
            onPress={handleWithdraw}
            disabled={isSubmitting}
          >
            <Text style={styles.secondaryButtonText}>
              {isSubmitting ? "Withdrawing..." : "Withdraw Application"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoadingApplication && !isPending ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {application ? "Update Application" : "New Application"}
            </Text>
            <Text style={styles.helperText}>
              Author access unlocks after admin review once both conditions are complete.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            <View style={styles.requirementsList}>
              {requirementItems.map((item) => (
                <View
                  key={item.key}
                  style={[
                    styles.requirementCard,
                    item.satisfied
                      ? styles.requirementCardSuccess
                      : styles.requirementCardIncomplete,
                  ]}
                >
                  <View style={styles.requirementIconWrap}>
                    <RequirementStatusIcon colors={colors} completed={item.satisfied} />
                  </View>
                  <View style={styles.requirementTextWrap}>
                    <Text style={styles.requirementTitle}>{item.label}</Text>
                    <Text style={styles.requirementDetail}>{item.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Step</Text>
            <Text style={styles.helperText}>
              Password-login accounts must verify email first. Google login does not need this
              extra step.
            </Text>
            {!hasCompleteProfile ? (
              <Pressable
                style={({ pressed }) => [
                  styles.outlineButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => router.push("/profile-edit")}
              >
                <Text style={styles.outlineButtonText}>Complete Profile</Text>
              </Pressable>
            ) : null}
            {!hasVerificationReady && !isGoogleLogin ? (
              <Pressable
                style={({ pressed }) => [
                  styles.outlineButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => router.push("/author-access-verification")}
              >
                <Text style={styles.outlineButtonText}>Open Verification Page</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || isSubmitting) && styles.buttonPressed,
                (isSubmitting || !canSubmitForApproval) && styles.buttonDisabled,
              ]}
              onPress={() => {
                void submitApplication();
              }}
              disabled={isSubmitting || !canSubmitForApproval}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting
                  ? "Submitting..."
                  : application
                    ? "Send Updated Application"
                    : "Submit For Approval"}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      padding: SPACING.xl,
      paddingBottom: SPACING.xxl * 2,
      gap: SPACING.md,
      backgroundColor: colors.background,
    },
    title: {
      color: colors.text,
      fontSize: FONT_SIZE.title,
      fontWeight: "700",
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
      borderRadius: RADIUS.lg,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      gap: SPACING.sm,
      ...SHADOWS.sm,
    },
    requirementsList: {
      gap: SPACING.sm,
    },
    requirementCard: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      backgroundColor: colors.surfaceSoft,
      padding: SPACING.md,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.sm,
    },
    requirementCardSuccess: {
      borderColor: colors.successBorder,
    },
    requirementCardIncomplete: {
      borderColor: colors.dangerBorder,
    },
    requirementIconWrap: {
      width: 24,
      alignItems: "center",
      paddingTop: 1,
    },
    requirementTextWrap: {
      flex: 1,
      gap: 2,
    },
    requirementTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    requirementDetail: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    helperText: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
    },
    statusCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
      padding: SPACING.lg,
      gap: SPACING.xs,
    },
    statusCardPending: {
      borderColor: colors.warningBorder,
      backgroundColor: colors.warningSoft,
    },
    statusCardRejected: {
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
    },
    statusCardWithdrawn: {
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
    },
    statusLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    statusText: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 20,
    },
    fieldGroup: {
      gap: SPACING.xs,
    },
    label: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
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
    textAreaWrap: {
      minHeight: 132,
      paddingVertical: SPACING.md,
      justifyContent: "flex-start",
    },
    textArea: {
      minHeight: 96,
      lineHeight: 20,
    },
    counterText: {
      color: colors.subtleText,
      fontSize: 11,
      textAlign: "right",
    },
    readonlyField: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surfaceSoft,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
    },
    readonlyValue: {
      color: colors.text,
      fontSize: FONT_SIZE.body,
      lineHeight: 20,
    },
    primaryButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    primaryButtonText: {
      color: colors.primaryText,
      fontSize: 15,
      fontWeight: "700",
    },
    outlineButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
      marginTop: SPACING.xs,
    },
    outlineButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    secondaryButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
      marginTop: SPACING.xs,
    },
    secondaryButtonText: {
      color: colors.danger,
      fontSize: 15,
      fontWeight: "700",
    },
    buttonPressed: {
      opacity: 0.9,
    },
    buttonDisabled: {
      opacity: 0.65,
    },
  });
