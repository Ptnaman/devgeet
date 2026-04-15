import { useEffect, useMemo, useState } from "react";
import { Redirect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
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
import {
  CATEGORIES_COLLECTION,
  getPreviewText,
  isPostTrashed,
  POSTS_COLLECTION,
  mapCategoryRecord,
  mapPostRecord,
  sortPostsByRecency,
  type CategoryRecord,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { getRequestErrorMessage } from "@/lib/network";
import { formatRelativeTime } from "@/lib/relative-time";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

type DashboardTone = "neutral" | "success" | "warning";

type DashboardActivityItem = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  tone: DashboardTone;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toTimeValue = (value: string) => {
  const parsedTime = Date.parse(value);
  return Number.isFinite(parsedTime) ? parsedTime : 0;
};

const isWithinLastDays = (value: string, days: number) => {
  const parsedTime = toTimeValue(value);
  return Boolean(parsedTime) && Date.now() - parsedTime <= days * DAY_IN_MS;
};

const getPostActivityTimestamp = (post: PostRecord) =>
  post.publishedAt || post.approvedAt || post.submittedAt || post.uploadDate || post.createDate;

const getPostActivityTitle = (post: PostRecord) => {
  if (post.status === "published") {
    return "Post published";
  }

  if (post.status === "pending") {
    return "Awaiting review";
  }

  return "Draft updated";
};

const resolveCategoryName = (value: string, categories: CategoryRecord[]) => {
  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue) {
    return "Uncategorized";
  }

  const matchedCategory = categories.find(
    (item) =>
      item.id.trim().toLowerCase() === normalizedValue ||
      item.slug.trim().toLowerCase() === normalizedValue ||
      item.name.trim().toLowerCase() === normalizedValue,
  );

  return matchedCategory?.name || value;
};

export default function AdminOverviewScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { isConnected } = useNetworkStatus();
  const router = useRouter();
  const { canManagePosts, isAdmin, profile } = useAuth();
  const {
    notifications: creatorNotifications,
    unreadCount: unreadCreatorAlerts,
    isLoading: isLoadingCreatorNotifications,
  } = useUserNotifications({ category: "creator" });
  const styles = createStyles(colors, resolvedTheme);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [applications, setApplications] = useState<AuthorApplicationRecord[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [postError, setPostError] = useState("");
  const [applicationError, setApplicationError] = useState("");
  const ownerUid = profile?.uid ?? "";

  useEffect(() => {
    const categoriesQuery = query(
      collection(firestore, CATEGORIES_COLLECTION),
      orderBy("name", "asc")
    );
    const postsQuery = query(collection(firestore, POSTS_COLLECTION));

    const unsubscribeCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        setCategories(
          snapshot.docs.map((item) =>
            mapCategoryRecord(item.id, item.data() as DocumentData)
          )
        );
        setCategoryError("");
        setIsLoadingCategories(false);
      },
      (snapshotError) => {
        setCategoryError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load categories.",
          })
        );
        setIsLoadingCategories(false);
      }
    );

    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        setPosts(
          sortPostsByRecency(
            snapshot.docs.map((item) =>
              mapPostRecord(item.id, item.data() as DocumentData)
            )
          )
        );
        setPostError("");
        setIsLoadingPosts(false);
      },
      (snapshotError) => {
        setPostError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load posts.",
          })
        );
        setIsLoadingPosts(false);
      }
    );

    return () => {
      unsubscribeCategories();
      unsubscribePosts();
    };
  }, [isConnected]);

  useEffect(() => {
    if (!isAdmin) {
      setApplications([]);
      setApplicationError("");
      setIsLoadingApplications(false);
      return;
    }

    setIsLoadingApplications(true);

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
        setApplicationError("");
        setIsLoadingApplications(false);
      },
      (snapshotError) => {
        setApplicationError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load author applications.",
          }),
        );
        setIsLoadingApplications(false);
      },
    );
  }, [isAdmin, isConnected]);

  const stats = useMemo(() => {
    const ownedPosts = isAdmin
      ? posts
      : posts.filter((item) => item.authorId === ownerUid || item.createdBy === ownerUid);
    const activePosts = ownedPosts.filter((item) => !isPostTrashed(item));
    const publishedPosts = activePosts.filter((item) => item.status === "published");
    const pendingPosts = activePosts.filter((item) => item.status === "pending");
    const draftPosts = activePosts.filter((item) => item.status === "draft");
    const trashed = ownedPosts.length - activePosts.length;
    const publishedThisWeek = publishedPosts.filter((item) =>
      isWithinLastDays(getPostActivityTimestamp(item), 7),
    ).length;
    const pendingApplications = applications.filter((item) => item.status === "pending").length;

    return {
      totalPosts: activePosts.length,
      published: publishedPosts.length,
      pending: pendingPosts.length,
      draft: draftPosts.length,
      trashed,
      categories: categories.length,
      publishedThisWeek,
      pendingApplications,
    };
  }, [applications, categories.length, isAdmin, ownerUid, posts]);

  const scopedPosts = useMemo(
    () =>
      isAdmin
        ? posts
        : posts.filter((item) => item.authorId === ownerUid || item.createdBy === ownerUid),
    [isAdmin, ownerUid, posts],
  );

  const activeScopedPosts = useMemo(
    () => scopedPosts.filter((item) => !isPostTrashed(item)),
    [scopedPosts],
  );

  const topCategories = useMemo(() => {
    const categoryUsage = new Map<string, number>();

    activeScopedPosts.forEach((item) => {
      const key = resolveCategoryName(item.category, categories);
      categoryUsage.set(key, (categoryUsage.get(key) ?? 0) + 1);
    });

    return [...categoryUsage.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([label, count]) => ({ label, count }));
  }, [activeScopedPosts, categories]);

  const topCreators = useMemo(() => {
    if (!isAdmin) {
      return [];
    }

    const creatorUsage = new Map<string, number>();

    activeScopedPosts.forEach((item) => {
      const key =
        item.authorDisplayName ||
        item.authorUsername ||
        item.createdByEmail ||
        "Unknown creator";
      creatorUsage.set(key, (creatorUsage.get(key) ?? 0) + 1);
    });

    return [...creatorUsage.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([label, count]) => ({ label, count }));
  }, [activeScopedPosts, isAdmin]);

  const recentActivity = useMemo<DashboardActivityItem[]>(() => {
    const postActivity = scopedPosts.slice(0, 5).map((item) => ({
      id: `post-${item.id}`,
      title: getPostActivityTitle(item),
      description: `${item.title} in ${resolveCategoryName(item.category, categories)}`,
      timestamp: getPostActivityTimestamp(item),
      tone:
        item.status === "published"
          ? "success"
          : item.status === "pending"
            ? "warning"
            : "neutral",
    }));

    const applicationActivity = isAdmin
      ? applications.slice(0, 4).map((item) => ({
          id: `application-${item.uid}`,
          title:
            item.status === "pending"
              ? "New author request"
              : item.status === "approved"
                ? "Author approved"
                : item.status === "rejected"
                  ? "Author rejected"
                  : "Application updated",
          description: `${item.displayName} • ${AUTHOR_APPLICATION_STATUS_LABELS[item.status]}`,
          timestamp: item.reviewedAt || item.updatedAt || item.requestedAt,
          tone:
            item.status === "approved"
              ? "success"
              : item.status === "pending"
                ? "warning"
                : "neutral",
        }))
      : [];

    const notificationActivity = creatorNotifications.slice(0, 3).map((item) => ({
      id: `notification-${item.id}`,
      title: item.title,
      description: getPreviewText(item.body, 72),
      timestamp: item.createdAt,
      tone: item.isRead ? "neutral" : "success",
    }));

    return [...postActivity, ...applicationActivity, ...notificationActivity]
      .filter((item) => item.timestamp)
      .sort((left, right) => toTimeValue(right.timestamp) - toTimeValue(left.timestamp))
      .slice(0, 8);
  }, [applications, categories, creatorNotifications, isAdmin, scopedPosts]);

  const attentionCards = useMemo(
    () =>
      [
        stats.pending
          ? {
              key: "pending",
              label: isAdmin ? "Posts Need Review" : "Waiting For Approval",
              value: stats.pending,
              detail: isAdmin
                ? "Open posts to moderate the review queue."
                : "Your submitted drafts are waiting for admin review.",
              tone: "warning" as DashboardTone,
              route: "/admin/posts",
            }
          : null,
        stats.draft
          ? {
              key: "draft",
              label: "Drafts To Finish",
              value: stats.draft,
              detail: "Resume unfinished writing from the post list.",
              tone: "neutral" as DashboardTone,
              route: "/admin/posts",
            }
          : null,
        isAdmin && stats.pendingApplications
          ? {
              key: "applications",
              label: "Author Requests",
              value: stats.pendingApplications,
              detail: "Pending creator applications need approval.",
              tone: "warning" as DashboardTone,
              route: "/admin/author-applications",
            }
          : null,
        unreadCreatorAlerts
          ? {
              key: "alerts",
              label: "Unread Creator Alerts",
              value: unreadCreatorAlerts,
              detail: "Open the header bell to review creator notifications.",
              tone: "success" as DashboardTone,
              route: "",
            }
          : null,
      ].filter(Boolean) as {
        key: string;
        label: string;
        value: number;
        detail: string;
        tone: DashboardTone;
        route: string;
      }[],
    [isAdmin, stats.draft, stats.pending, stats.pendingApplications, unreadCreatorAlerts],
  );

  const overviewCards = [
    {
      key: "total-posts",
      label: isAdmin ? "Active Posts" : "My Posts",
      value: stats.totalPosts,
      helper: isAdmin ? "Across all creators" : "Visible in your studio",
    },
    {
      key: "published",
      label: "Published",
      value: stats.published,
      helper: stats.publishedThisWeek
        ? `${stats.publishedThisWeek} published this week`
        : "No fresh publish burst yet",
    },
    {
      key: "pending",
      label: isAdmin ? "Pending Review" : "Awaiting Review",
      value: stats.pending,
      helper: isAdmin ? "Needs moderation" : "Waiting for admin approval",
    },
    {
      key: "drafts",
      label: "Drafts",
      value: stats.draft,
      helper: stats.draft ? "Ready to continue writing" : "Nothing left in draft",
    },
    {
      key: "alerts",
      label: "Creator Alerts",
      value: unreadCreatorAlerts,
      helper: unreadCreatorAlerts ? "Unread creator notifications" : "Notification inbox is clear",
    },
    {
      key: "last-card",
      label: isAdmin ? "Author Requests" : "Categories",
      value: isAdmin ? stats.pendingApplications : stats.categories,
      helper: isAdmin ? "Pending creator approvals" : "Available publishing categories",
    },
  ];

  const quickActions = [
    {
      key: "create-post",
      title: "Create Post",
      meta: isAdmin ? "Open the editor for a new story." : "Start a new draft immediately.",
      route: "/admin/posts/edit",
      primary: true,
    },
    {
      key: "posts",
      title: isAdmin ? "Post List" : "My Posts",
      meta: isAdmin
        ? `${stats.pending} waiting review, ${stats.published} published`
        : `${stats.draft} drafts, ${stats.pending} in review`,
      route: "/admin/posts",
      primary: false,
    },
    {
      key: "categories",
      title: "Categories",
      meta: `${stats.categories} categories available right now`,
      route: "/admin/categories",
      primary: false,
    },
    ...(isAdmin
      ? [
          {
            key: "applications",
            title: "Author Applications",
            meta: `${stats.pendingApplications} requests waiting for review`,
            route: "/admin/author-applications",
            primary: false,
          },
          {
            key: "notifications",
            title: "Notifications",
            meta: "Send creator-only updates and announcements.",
            route: "/admin/notifications",
            primary: false,
          },
          {
            key: "users",
            title: "Users",
            meta: "Manage roles, status, and access control.",
            route: "/admin/users",
            primary: false,
          },
        ]
      : []),
  ];

  const error = categoryError || postError || applicationError;
  const isLoading =
    isLoadingCategories ||
    isLoadingPosts ||
    isLoadingCreatorNotifications ||
    (isAdmin && isLoadingApplications);

  if (!canManagePosts) {
    return <Redirect href="/settings" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{isAdmin ? "Admin Control Center" : "Creator Studio"}</Text>
      <Text style={styles.subtitle}>
        {isAdmin
          ? "Moderation, creator approvals, and publishing signals now sit in one live dashboard."
          : "Track your drafts, review queue, and creator alerts without leaving the studio."}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.sectionDivider} />
        <View style={styles.statsGrid}>
          {overviewCards.map((item) => (
            <View key={item.key} style={styles.statCard}>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statHelper}>{item.helper}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attention Needed</Text>
        <View style={styles.sectionDivider} />
        {!attentionCards.length && !isLoading ? (
          <Text style={styles.emptyText}>
            {isAdmin
              ? "Nothing urgent right now. Review queues and creator alerts are clear."
              : "No blockers right now. Your drafts and notifications are under control."}
          </Text>
        ) : null}
        <View style={styles.attentionGrid}>
          {attentionCards.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.attentionCard,
                item.tone === "warning"
                  ? styles.attentionCardWarning
                  : item.tone === "success"
                    ? styles.attentionCardSuccess
                    : styles.attentionCardNeutral,
                item.route && pressed && styles.buttonPressed,
              ]}
              onPress={item.route ? () => router.push(item.route) : undefined}
              disabled={!item.route}
            >
              <View style={styles.attentionTopRow}>
                <Text style={styles.attentionLabel}>{item.label}</Text>
                <Text style={styles.attentionValue}>{item.value}</Text>
              </View>
              <Text style={styles.attentionDetail}>{item.detail}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.sectionDivider} />
        {!recentActivity.length && !isLoading ? (
          <Text style={styles.emptyText}>No recent activity yet.</Text>
        ) : null}
        <View style={styles.activityList}>
          {recentActivity.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View
                style={[
                  styles.activityDot,
                  item.tone === "warning"
                    ? styles.activityDotWarning
                    : item.tone === "success"
                      ? styles.activityDotSuccess
                      : styles.activityDotNeutral,
                ]}
              />
              <View style={styles.activityContent}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityTitle}>{item.title}</Text>
                  <Text style={styles.activityTime}>{formatRelativeTime(item.timestamp)}</Text>
                </View>
                <Text style={styles.activityDescription}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Insights</Text>
        <View style={styles.sectionDivider} />
        <View style={styles.insightGrid}>
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>
              {isAdmin ? "Top Categories" : "Your Category Mix"}
            </Text>
            {!topCategories.length ? (
              <Text style={styles.emptyText}>No category data yet.</Text>
            ) : (
              <View style={styles.insightList}>
                {topCategories.map((item) => (
                  <View key={item.label} style={styles.insightRow}>
                    <Text style={styles.insightLabel}>{item.label}</Text>
                    <Text style={styles.insightValue}>{item.count}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>
              {isAdmin ? "Top Creators" : "Latest Creator Alerts"}
            </Text>
            {isAdmin ? (
              !topCreators.length ? (
                <Text style={styles.emptyText}>No creator activity yet.</Text>
              ) : (
                <View style={styles.insightList}>
                  {topCreators.map((item) => (
                    <View key={item.label} style={styles.insightRow}>
                      <Text style={styles.insightLabel}>{item.label}</Text>
                      <Text style={styles.insightValue}>{item.count}</Text>
                    </View>
                  ))}
                </View>
              )
            ) : !creatorNotifications.length ? (
              <Text style={styles.emptyText}>No creator notifications yet.</Text>
            ) : (
              <View style={styles.insightList}>
                {creatorNotifications.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.insightRow}>
                    <View style={styles.insightNotificationCopy}>
                      <Text style={styles.insightLabel}>{item.title}</Text>
                      <Text style={styles.insightMuted}>{getPreviewText(item.body, 44)}</Text>
                    </View>
                    <Text style={styles.insightMuted}>{formatRelativeTime(item.createdAt)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.sectionDivider} />
        <View style={styles.quickGrid}>
          {quickActions.map((item) =>
            item.primary ? (
              <Pressable
                key={item.key}
                style={({ pressed }) => [styles.quickCardPrimary, pressed && styles.buttonPressed]}
                onPress={() => router.push(item.route)}
              >
                <Text style={styles.quickCardTitlePrimary}>{item.title}</Text>
                <Text style={styles.quickCardMetaPrimary}>{item.meta}</Text>
              </Pressable>
            ) : (
              <Pressable
                key={item.key}
                style={({ pressed }) => [styles.quickCard, pressed && styles.buttonPressed]}
                onPress={() => router.push(item.route)}
              >
                <Text style={styles.quickCardTitle}>{item.title}</Text>
                <Text style={styles.quickCardMeta}>{item.meta}</Text>
              </Pressable>
            ),
          )}
        </View>
      </View>

      {isAdmin && stats.trashed ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recycle Bin</Text>
          <View style={styles.sectionDivider} />
          <Text style={styles.recycleBinCopy}>
            {stats.trashed} post{stats.trashed === 1 ? "" : "s"} currently sit in the recycle bin.
            Open the post list to restore or permanently clean them up.
          </Text>
        </View>
      ) : null}
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
      lineHeight: 21,
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
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm,
    },
    statCard: {
      flexBasis: "48%",
      flexGrow: 1,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: outlineColor,
      gap: 2,
    },
    statLabel: {
      fontSize: 12,
      color: colors.mutedText,
      textTransform: "uppercase",
      fontWeight: "600",
    },
    statValue: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    statHelper: {
      fontSize: 12,
      color: colors.mutedText,
      lineHeight: 17,
    },
    emptyText: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
      lineHeight: 20,
    },
    attentionGrid: {
      gap: SPACING.sm,
    },
    attentionCard: {
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderWidth: 1,
      gap: SPACING.xs,
    },
    attentionCardNeutral: {
      backgroundColor: colors.surfaceMuted,
      borderColor: outlineColor,
    },
    attentionCardWarning: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningBorder,
    },
    attentionCardSuccess: {
      backgroundColor: colors.successSoft,
      borderColor: colors.successBorder,
    },
    attentionTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: SPACING.sm,
    },
    attentionLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    attentionValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    attentionDetail: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 19,
    },
    activityList: {
      gap: SPACING.md,
    },
    activityRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.sm,
    },
    activityDot: {
      width: 10,
      height: 10,
      borderRadius: RADIUS.pill,
      marginTop: 6,
      flexShrink: 0,
    },
    activityDotNeutral: {
      backgroundColor: colors.mutedText,
    },
    activityDotWarning: {
      backgroundColor: colors.warning,
    },
    activityDotSuccess: {
      backgroundColor: colors.success,
    },
    activityContent: {
      flex: 1,
      gap: 4,
    },
    activityHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: SPACING.sm,
    },
    activityTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    activityTime: {
      color: colors.mutedText,
      fontSize: 12,
    },
    activityDescription: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 19,
    },
    insightGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm,
    },
    insightCard: {
      flexBasis: "48%",
      flexGrow: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surfaceMuted,
      gap: SPACING.sm,
    },
    insightTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    insightList: {
      gap: SPACING.sm,
    },
    insightRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: SPACING.sm,
    },
    insightLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    insightValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    insightMuted: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 17,
    },
    insightNotificationCopy: {
      flex: 1,
      gap: 2,
    },
    quickGrid: {
      gap: SPACING.sm,
    },
    quickCardPrimary: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      gap: 4,
    },
    quickCardTitlePrimary: {
      color: colors.primaryText,
      fontSize: 15,
      fontWeight: "700",
    },
    quickCardMetaPrimary: {
      color: colors.primaryMutedText,
      fontSize: 12,
      lineHeight: 17,
    },
    quickCard: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: outlineColor,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      gap: 4,
    },
    quickCardTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    quickCardMeta: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 17,
    },
    recycleBinCopy: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
      lineHeight: 20,
    },
    buttonPressed: {
      opacity: 0.9,
    },
  });
};
