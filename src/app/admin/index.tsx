import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Redirect, useRouter, type Href } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { collection, onSnapshot, orderBy, query, type DocumentData } from "firebase/firestore";

import { AdminPanelIcon } from "@/components/icons/admin-panel-icon";
import { ArrowRightIcon } from "@/components/icons/arrow-right-icon";
import { CategoryTabIcon } from "@/components/icons/category-tab-icon";
import { PlusIcon } from "@/components/icons/plus-icon";
import { UserAvatarIcon } from "@/components/icons/user-avatar-icon";
import {
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
  type ThemeMode,
} from "@/constants/theme";
import {
  CATEGORIES_COLLECTION,
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
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

type DashboardActionItem = {
  key: string;
  title: string;
  route: Href;
  disabled?: boolean;
};

type DashboardOverviewCard = {
  key: string;
  label: string;
  value: number;
  tone: "neutral" | "accent" | "success" | "warning";
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

export default function AdminOverviewScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { isConnected } = useNetworkStatus();
  const router = useRouter();
  const { canManagePosts, isAdmin, profile } = useAuth();
  const styles = createStyles(colors, resolvedTheme);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState("");
  const ownerUid = profile?.uid ?? "";

  useEffect(() => {
    const categoriesQuery = query(collection(firestore, CATEGORIES_COLLECTION), orderBy("name", "asc"));
    const postsQuery = query(collection(firestore, POSTS_COLLECTION));

    const unsubscribeCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        setCategories(snapshot.docs.map((item) => mapCategoryRecord(item.id, item.data() as DocumentData)));
        setError("");
        setIsLoadingCategories(false);
      },
      (snapshotError) => {
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load categories.",
          }),
        );
        setIsLoadingCategories(false);
      },
    );

    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        setPosts(
          sortPostsByRecency(snapshot.docs.map((item) => mapPostRecord(item.id, item.data() as DocumentData))),
        );
        setError("");
        setIsLoadingPosts(false);
      },
      (snapshotError) => {
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load posts.",
          }),
        );
        setIsLoadingPosts(false);
      },
    );

    return () => {
      unsubscribeCategories();
      unsubscribePosts();
    };
  }, [isConnected]);

  const stats = useMemo(() => {
    const ownedPosts = isAdmin
      ? posts
      : posts.filter((item) => item.authorId === ownerUid || item.createdBy === ownerUid);
    const activePosts = ownedPosts.filter((item) => !isPostTrashed(item));
    const publishedPosts = activePosts.filter((item) => item.status === "published");
    const pendingPosts = activePosts.filter((item) => item.status === "pending");
    const draftPosts = activePosts.filter((item) => item.status === "draft");
    const publishedThisWeek = publishedPosts.filter((item) =>
      isWithinLastDays(getPostActivityTimestamp(item), 7),
    ).length;

    return {
      totalPosts: activePosts.length,
      published: publishedPosts.length,
      pending: pendingPosts.length,
      draft: draftPosts.length,
      categories: categories.length,
      publishedThisWeek,
    };
  }, [categories.length, isAdmin, ownerUid, posts]);

  const overviewCards: DashboardOverviewCard[] = [
    {
      key: "total-posts",
      label: isAdmin ? "Active Posts" : "My Posts",
      value: stats.totalPosts,
      tone: "accent",
    },
    {
      key: "published",
      label: "Published",
      value: stats.published,
      tone: "success",
    },
    {
      key: "pending",
      label: isAdmin ? "Pending Review" : "Awaiting Review",
      value: stats.pending,
      tone: "warning",
    },
    {
      key: "drafts",
      label: "Drafts",
      value: stats.draft,
      tone: "neutral",
    },
    {
      key: "categories",
      label: "Categories",
      value: stats.categories,
      tone: "neutral",
    },
  ];

  const quickActions: DashboardActionItem[] = [
    {
      key: "create-post",
      title: "Create Post",
      route: "/admin/posts/edit" as Href,
    },
    {
      key: "posts",
      title: isAdmin ? "Post List" : "My Posts",
      route: "/admin/posts" as Href,
    },
    {
      key: "categories",
      title: "Categories",
      route: "/admin/categories" as Href,
    },
    {
      key: "notifications",
      title: "Custom Notifications",
      route: "/admin/notifications" as Href,
      disabled: !isAdmin,
    },
    {
      key: "users",
      title: "Users",
      route: "/admin/users" as Href,
      disabled: !isAdmin,
    },
  ];

  const isLoading = isLoadingCategories || isLoadingPosts;

  if (!canManagePosts) {
    return <Redirect href="/settings" />;
  }

  const overviewToneStyles: Record<DashboardOverviewCard["tone"], object> = {
    neutral: styles.metricTileNeutral,
    accent: styles.metricTileAccent,
    success: styles.metricTileSuccess,
    warning: styles.metricTileWarning,
  };
  const actionIcons: Record<string, ReactNode> = {
    "create-post": <PlusIcon color={colors.accent} size={18} />,
    posts: <AdminPanelIcon color={colors.accent} size={18} />,
    categories: <CategoryTabIcon color={colors.accent} size={18} />,
    notifications: <AdminPanelIcon color={colors.accent} size={18} />,
    users: <UserAvatarIcon color={colors.accent} size={18} />,
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Syncing metrics...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.metricsWrap}>
        {overviewCards.map((item) => (
          <View key={item.key} style={[styles.metricTile, overviewToneStyles[item.tone]]}>
            <Text style={styles.metricValue}>{item.value}</Text>
            <Text style={styles.metricLabel} numberOfLines={2}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Admin Actions</Text>
      <View style={styles.groupCard}>
        {quickActions.map((item, index) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [
              styles.row,
              index < quickActions.length - 1 && styles.rowDivider,
              pressed && !item.disabled && styles.rowPressed,
              item.disabled && styles.rowDisabled,
            ]}
            onPress={item.disabled ? undefined : () => router.push(item.route)}
            disabled={item.disabled}
          >
            <View style={styles.rowContent}>
              <View style={styles.rowMain}>
                <View style={styles.rowIconWrap}>
                  {actionIcons[item.key]}
                </View>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <ArrowRightIcon size={20} color={colors.subtleText} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, resolvedTheme: ThemeMode) => {
  const outlineColor = resolvedTheme === "dark" ? colors.divider : colors.border;

  return StyleSheet.create({
    container: {
      padding: SPACING.md,
      gap: SPACING.md,
      backgroundColor: colors.background,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: outlineColor,
    },
    loadingText: {
      color: colors.mutedText,
      fontSize: 12,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 19,
    },
    sectionLabel: {
      color: colors.text,
      fontSize: 21,
      fontWeight: "600",
      
    },
    metricsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: SPACING.sm,
      marginTop: SPACING.md,
      marginBottom: SPACING.md,
      paddingHorizontal: 2,
    },
    metricTile: {
      width: "48%",
      minHeight: 84,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderWidth: 1,
      borderColor: outlineColor,
      borderLeftWidth: 4,
      backgroundColor: colors.surface,
      justifyContent: "center",
      alignItems: "flex-start",
      ...SHADOWS.sm,
    },
    metricTileNeutral: {
      backgroundColor: colors.surface,
      borderLeftColor: colors.subtleText,
    },
    metricTileAccent: {
      backgroundColor: colors.surface,
      borderLeftColor: colors.accent,
    },
    metricTileSuccess: {
      backgroundColor: colors.surface,
      borderLeftColor: colors.success,
    },
    metricTileWarning: {
      backgroundColor: colors.surface,
      borderLeftColor: colors.warning,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.text,
      lineHeight: 28,
    },
    metricLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.mutedText,
      textTransform: "capitalize",
      letterSpacing: 0.15,
      lineHeight: 14,
    },
    groupCard: {
      borderRadius: RADIUS.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: SPACING.sm,
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
      opacity: 0.55,
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
    rowTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
      flex: 1,
    },
    rowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
  });
};
