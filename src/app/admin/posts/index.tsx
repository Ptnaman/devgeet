import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
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
  CATEGORIES_COLLECTION,
  POSTS_COLLECTION,
  formatDate,
  getPostCardThumbnailUrl,
  isPostTrashed,
  mapCategoryRecord,
  mapPostRecord,
  sortPostsByRecency,
  type CategoryRecord,
  type PostRecord,
  type PostStatus,
} from "@/lib/content";
import { TrashActionIcon } from "@/components/icons/trash-action-icon";
import { firestore } from "@/lib/firebase";
import { getActionErrorMessage, getRequestErrorMessage } from "@/lib/network";
import { notifyPostPublishedAsync } from "@/lib/notifications";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const POST_STATUSES: PostStatus[] = ["draft", "pending", "published"];
type PostStatusFilter = "all" | PostStatus;
const DEFAULT_CATEGORY = "general";

const getStatusLabel = (status: PostStatus) => {
  if (status === "pending") {
    return "Pending Review";
  }

  return status === "published" ? "Published" : "Draft";
};

const getPostPreview = (content: string) => {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
};

export default function AdminPostsListScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { isConnected, showToast } = useNetworkStatus();
  const router = useRouter();
  const { canManagePosts, canModeratePosts, isAdmin, role, user } = useAuth();
  const styles = createStyles(colors, resolvedTheme);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [statusFilter, setStatusFilter] = useState<PostStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isViewingRecycleBin, setIsViewingRecycleBin] = useState(false);

  useEffect(() => {
    setIsLoadingCategories(true);
    setIsLoadingPosts(true);

    if (!canModeratePosts && !user?.uid) {
      setPosts([]);
      setIsLoadingCategories(false);
      setIsLoadingPosts(false);
      return;
    }

    const categoriesQuery = query(
      collection(firestore, CATEGORIES_COLLECTION),
      orderBy("name", "asc")
    );
    const postsQuery = canModeratePosts
      ? query(collection(firestore, POSTS_COLLECTION))
      : query(
          collection(firestore, POSTS_COLLECTION),
          where("createdBy", "==", user?.uid ?? ""),
        );

    const unsubscribeCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        setCategories(
          snapshot.docs.map((item) =>
            mapCategoryRecord(item.id, item.data() as DocumentData)
          )
        );
        setIsLoadingCategories(false);
        setError("");
      },
      (snapshotError) => {
        setIsLoadingCategories(false);
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load categories.",
          }),
        );
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
        setIsLoadingPosts(false);
        setError("");
      },
      (snapshotError) => {
        setIsLoadingPosts(false);
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load posts.",
          }),
        );
      }
    );

    return () => {
      unsubscribeCategories();
      unsubscribePosts();
    };
  }, [canModeratePosts, isConnected, user?.uid]);

  const isLoadingData = isLoadingCategories || isLoadingPosts;

  const scopedPosts = useMemo(() => {
    if (canModeratePosts) {
      return posts;
    }

    if (!user?.uid) {
      return [];
    }

    return posts.filter(
      (post) => post.createdBy === user.uid || (!!user.email && post.createdByEmail === user.email)
    );
  }, [canModeratePosts, posts, user?.email, user?.uid]);

  const activePosts = useMemo(
    () => scopedPosts.filter((post) => !isPostTrashed(post)),
    [scopedPosts],
  );

  const trashedPosts = useMemo(
    () => scopedPosts.filter((post) => isPostTrashed(post)),
    [scopedPosts],
  );

  const filteredPosts = useMemo(() => {
    const sourcePosts = isViewingRecycleBin ? trashedPosts : activePosts;

    return sourcePosts.filter((post) => {
      if (statusFilter !== "all" && post.status !== statusFilter) {
        return false;
      }

      if (categoryFilter !== "all" && post.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [activePosts, categoryFilter, isViewingRecycleBin, statusFilter, trashedPosts]);

  const hasActiveFilters = statusFilter !== "all" || categoryFilter !== "all";

  const postStats = useMemo(() => {
    return {
      total: activePosts.length,
      visible: filteredPosts.length,
      draft: activePosts.filter((post) => post.status === "draft").length,
      pending: activePosts.filter((post) => post.status === "pending").length,
      published: activePosts.filter((post) => post.status === "published").length,
      trashed: trashedPosts.length,
    };
  }, [activePosts, filteredPosts.length, trashedPosts.length]);

  if (!canManagePosts) {
    return <Redirect href="/settings" />;
  }

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

  const handleModeratePost = async (post: PostRecord, nextStatus: PostStatus) => {
    if (!canModeratePosts) {
      return;
    }

    try {
      clearFeedback();
      const postRef = doc(firestore, POSTS_COLLECTION, post.id);
      await setDoc(
        postRef,
        {
          status: nextStatus,
          uploadDate: serverTimestamp(),
          submittedAt:
            nextStatus === "published" ? post.submittedAt || serverTimestamp() : null,
          publishedAt: nextStatus === "published" ? serverTimestamp() : null,
          approvedAt: nextStatus === "published" ? serverTimestamp() : null,
          approvedBy: nextStatus === "published" ? user?.uid ?? "" : null,
          approvedByEmail: nextStatus === "published" ? user?.email ?? "" : null,
        },
        { merge: true }
      );
      setSuccess(
        nextStatus === "published"
          ? "Post approved and published."
          : "Post moved back to draft."
      );

      if (
        nextStatus === "published" &&
        post.status !== "published"
      ) {
        void notifyPostPublishedAsync({
          authorUid: post.authorId,
          actorUid: user?.uid,
          postId: post.id,
          postTitle: post.title,
          postContent: post.content,
          imageUrl: getPostCardThumbnailUrl(post),
        }).catch((notificationError) => {
          console.warn("Unable to send publish notification.", notificationError);
          showToast("Post published, but notification could not be delivered.");
        });
      }
    } catch (updateError) {
      setError(
        getActionErrorMessage({
          error: updateError,
          isConnected,
          fallbackMessage: "Unable to update post status.",
        }),
      );
    }
  };

  const handleSubmitForReview = async (post: PostRecord) => {
    if (canModeratePosts) {
      return;
    }

    try {
      clearFeedback();
      await setDoc(
        doc(firestore, POSTS_COLLECTION, post.id),
        {
          authorRole: role,
          status: "pending",
          submittedAt: serverTimestamp(),
          uploadDate: serverTimestamp(),
          approvedAt: null,
          approvedBy: null,
          approvedByEmail: null,
        },
        { merge: true }
      );
      setSuccess("Post submitted for admin approval.");
    } catch (submitError) {
      setError(
        getActionErrorMessage({
          error: submitError,
          isConnected,
          fallbackMessage: "Unable to submit post for review.",
        }),
      );
    }
  };

  const runMovePostToRecycleBin = async (post: PostRecord) => {
    try {
      clearFeedback();
      await setDoc(
        doc(firestore, POSTS_COLLECTION, post.id),
        {
          deletedAt: serverTimestamp(),
          deletedBy: user?.uid ?? "",
          deletedByEmail: user?.email ?? "",
          uploadDate: serverTimestamp(),
        },
        { merge: true }
      );
      setSuccess("Post moved to recycle bin.");
    } catch (deleteError) {
      setError(
        getActionErrorMessage({
          error: deleteError,
          isConnected,
          fallbackMessage: "Unable to move post to recycle bin.",
        }),
      );
    }
  };

  const runRestorePost = async (post: PostRecord) => {
    try {
      clearFeedback();
      await setDoc(
        doc(firestore, POSTS_COLLECTION, post.id),
        {
          deletedAt: null,
          deletedBy: null,
          deletedByEmail: null,
          uploadDate: serverTimestamp(),
        },
        { merge: true }
      );
      setSuccess("Post restored from recycle bin.");
    } catch (restoreError) {
      setError(
        getActionErrorMessage({
          error: restoreError,
          isConnected,
          fallbackMessage: "Unable to restore post.",
        }),
      );
    }
  };

  const runDeletePostPermanently = async (post: PostRecord) => {
    try {
      clearFeedback();
      await deleteDoc(doc(firestore, POSTS_COLLECTION, post.id));
      setSuccess("Post deleted permanently.");
    } catch (deleteError) {
      setError(
        getActionErrorMessage({
          error: deleteError,
          isConnected,
          fallbackMessage: "Unable to delete post permanently.",
        }),
      );
    }
  };

  const handleMovePostToRecycleBin = (post: PostRecord) => {
    Alert.alert("Move to Recycle Bin", `Move "${post.title}" to recycle bin?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Move",
        style: "destructive",
        onPress: () => {
          void runMovePostToRecycleBin(post);
        },
      },
    ]);
  };

  const handleDeletePostPermanently = (post: PostRecord) => {
    Alert.alert("Delete Permanently", `Delete "${post.title}" permanently? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void runDeletePostPermanently(post);
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{isAdmin ? "Post List" : "My Posts"}</Text>
      <Text style={styles.subtitle}>
        {isAdmin
          ? "Filter, review, and publish posts quickly."
          : "Create posts, submit them for review, and track approval status."}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Action</Text>
        <View style={styles.sectionDivider} />
        <View style={styles.quickActionStack}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => router.push("/admin/posts/edit")}
          >
            <Text style={styles.primaryButtonText}>Create Post</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              styles.quickActionButton,
              isViewingRecycleBin && styles.recycleBinButtonActive,
            ]}
            activeOpacity={0.85}
            onPress={() => {
              setIsViewingRecycleBin((current) => !current);
              clearFeedback();
            }}
          >
            <View style={styles.recycleBinButtonContent}>
              <TrashActionIcon
                color={isViewingRecycleBin ? colors.primaryText : colors.danger}
                size={18}
              />
              <Text
                style={[
                  styles.recycleBinButtonText,
                  isViewingRecycleBin && styles.recycleBinButtonTextActive,
                ]}
              >
                {isViewingRecycleBin ? "Back to Posts" : `Recycle Bin (${postStats.trashed})`}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.filterHeader}>
          <Text style={styles.sectionTitle}>Filters</Text>
          <TouchableOpacity
            style={[
              styles.resetInlineButton,
              !hasActiveFilters && styles.buttonDisabled,
            ]}
            activeOpacity={0.85}
            onPress={() => {
              setStatusFilter("all");
              setCategoryFilter("all");
              clearFeedback();
            }}
            disabled={!hasActiveFilters}
          >
            <Text style={styles.resetInlineButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sectionDivider} />
        {isLoadingData ? <ActivityIndicator size="small" color={colors.primary} /> : null}

        <View style={styles.compactFilterRow}>
          <Text style={styles.compactFilterLabel}>Status</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {(["all", ...POST_STATUSES] as PostStatusFilter[]).map((item) => (
              <Pressable
                key={item}
                style={[styles.chip, statusFilter === item ? styles.chipActive : undefined]}
                onPress={() => setStatusFilter(item)}
              >
                <Text
                  style={[
                    styles.chipText,
                    statusFilter === item ? styles.chipTextActive : undefined,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.compactFilterRow}>
          <Text style={styles.compactFilterLabel}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable
              style={[styles.chip, categoryFilter === "all" ? styles.chipActive : undefined]}
              onPress={() => setCategoryFilter("all")}
            >
              <Text
                style={[
                  styles.chipText,
                  categoryFilter === "all" ? styles.chipTextActive : undefined,
                ]}
              >
                all
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.chip,
                categoryFilter === DEFAULT_CATEGORY ? styles.chipActive : undefined,
              ]}
              onPress={() => setCategoryFilter(DEFAULT_CATEGORY)}
            >
              <Text
                style={[
                  styles.chipText,
                  categoryFilter === DEFAULT_CATEGORY ? styles.chipTextActive : undefined,
                ]}
              >
                {DEFAULT_CATEGORY}
              </Text>
            </Pressable>
            {categories.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.chip, categoryFilter === item.slug ? styles.chipActive : undefined]}
                onPress={() => setCategoryFilter(item.slug)}
              >
                <Text
                  style={[
                    styles.chipText,
                    categoryFilter === item.slug ? styles.chipTextActive : undefined,
                  ]}
                >
                  {item.slug}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.resultText}>
          Showing {postStats.visible} of {isViewingRecycleBin ? postStats.trashed : postStats.total}{" "}
          {isViewingRecycleBin ? "trashed posts" : "posts"}
        </Text>
        <Text style={styles.resultText}>
          Draft {postStats.draft} • Pending {postStats.pending} • Published {postStats.published} • Recycle Bin {postStats.trashed}
        </Text>
      </View>

      <View style={styles.postsSection}>
        <Text style={styles.sectionTitle}>{isViewingRecycleBin ? "Recycle Bin" : "Posts"}</Text>
        {!filteredPosts.length ? (
          <Text style={styles.emptyText}>
            {isViewingRecycleBin
              ? "Recycle bin is empty or nothing matches current filters."
              : "No posts match current filters."}
          </Text>
        ) : null}

        <View style={styles.postsStack}>
          {filteredPosts.map((post) => {
            const thumbnailUrl = getPostCardThumbnailUrl(post);
            const isTrashed = isPostTrashed(post);
            const updatedLabel = formatDate(post.uploadDate || post.createDate);
            const createdLabel = formatDate(post.createDate);
            const categoryLabel = post.category.trim() || DEFAULT_CATEGORY;
            const postPreview = getPostPreview(post.content);
            const activityLabel =
              isTrashed && post.deletedAt
                ? `Trashed ${formatDate(post.deletedAt)}`
                : post.status === "pending" && post.submittedAt
                ? `Submitted ${formatDate(post.submittedAt)}`
                : post.status === "published" && post.approvedAt
                  ? `Approved ${formatDate(post.approvedAt)}`
                  : `Created ${createdLabel}`;
            const authorLabel =
              post.authorDisplayName ||
              post.authorUsername ||
              post.createdByEmail ||
              "Unknown";

            return (
              <View key={post.id} style={styles.postCard}>
                <TouchableOpacity
                  style={[
                    styles.postCardContent,
                    isTrashed && styles.postCardContentDisabled,
                  ]}
                  activeOpacity={0.9}
                  onPress={
                    isTrashed ? undefined : () => router.push(`/admin/posts/edit?postId=${post.id}`)
                  }
                  disabled={isTrashed}
                >
                  <View style={styles.postMainRow}>
                    <View style={styles.postContentColumn}>
                      <View style={styles.postTopRow}>
                        <View style={styles.badgeRow}>
                          <Text style={styles.categoryBadge}>{categoryLabel}</Text>
                          {isTrashed ? (
                            <View style={[styles.statusBadge, styles.statusBadgeTrashed]}>
                              <Text style={[styles.statusBadgeText, styles.statusBadgeTextTrashed]}>
                                Recycled
                              </Text>
                            </View>
                          ) : null}
                          <View
                            style={[
                              styles.statusBadge,
                              post.status === "published"
                                ? styles.statusBadgePublished
                                : post.status === "pending"
                                  ? styles.statusBadgePending
                                  : styles.statusBadgeDraft,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                post.status === "published"
                                  ? styles.statusBadgeTextPublished
                                  : post.status === "pending"
                                    ? styles.statusBadgeTextPending
                                    : styles.statusBadgeTextDraft,
                              ]}
                            >
                              {getStatusLabel(post.status)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.postMeta}>{updatedLabel}</Text>
                      </View>

                      <Text style={styles.postTitle} numberOfLines={2}>
                        {post.title}
                      </Text>

                      {postPreview ? (
                        <Text style={styles.postSummary} numberOfLines={2}>
                          {postPreview}
                        </Text>
                      ) : null}

                      <Text style={styles.postMeta} numberOfLines={1}>
                        {authorLabel}
                      </Text>
                      <Text style={styles.postMeta} numberOfLines={1}>
                        {post.slug} • {activityLabel}
                      </Text>
                    </View>

                    {thumbnailUrl ? (
                      <Image
                        source={{ uri: thumbnailUrl }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>

                <View style={styles.cardActions}>
                  {isTrashed ? (
                    <TouchableOpacity
                      style={[styles.primaryButton, styles.actionButton]}
                      activeOpacity={0.85}
                      onPress={() => {
                        void runRestorePost(post);
                      }}
                    >
                      <Text style={styles.primaryButtonText}>Restore</Text>
                    </TouchableOpacity>
                  ) : canModeratePosts ? (
                    <TouchableOpacity
                      style={[styles.primaryButton, styles.actionButton]}
                      activeOpacity={0.85}
                      onPress={() => {
                        void handleModeratePost(
                          post,
                          post.status === "published" ? "draft" : "published"
                        );
                      }}
                    >
                      <Text style={styles.primaryButtonText}>
                        {post.status === "published" ? "Move Draft" : "Publish"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.secondaryButton,
                        styles.actionButton,
                        (post.status === "pending" || post.status === "published") &&
                          styles.buttonDisabled,
                      ]}
                      activeOpacity={0.85}
                      onPress={() => {
                        void handleSubmitForReview(post);
                      }}
                      disabled={post.status === "pending" || post.status === "published"}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {post.status === "pending"
                          ? "In Review"
                          : post.status === "published"
                            ? "Published"
                            : "Submit"}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.deleteButton, styles.actionButton]}
                    activeOpacity={0.85}
                    onPress={() =>
                      isTrashed
                        ? handleDeletePostPermanently(post)
                        : handleMovePostToRecycleBin(post)
                    }
                  >
                    <Text style={styles.deleteButtonText}>
                      {isTrashed ? "Delete Forever" : "Trash"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, resolvedTheme: "light" | "dark") => {
  const outlineColor = resolvedTheme === "dark" ? colors.divider : colors.border;

  return StyleSheet.create({
    container: {
      padding: SPACING.xl,
      backgroundColor: colors.background,
      gap: SPACING.md,
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
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.sm,
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
    primaryButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.md,
    },
    quickActionStack: {
      gap: SPACING.sm,
    },
    quickActionButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      paddingHorizontal: SPACING.md,
    },
    recycleBinButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    recycleBinButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.xs,
    },
    recycleBinButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    recycleBinButtonTextActive: {
      color: colors.primaryText,
    },
    primaryButtonText: {
      color: colors.primaryText,
      fontSize: FONT_SIZE.button,
      fontWeight: "700",
      textAlign: "center",
    },
    filterHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.sm,
    },
    compactFilterRow: {
      gap: SPACING.xs,
    },
    compactFilterLabel: {
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      paddingRight: SPACING.md,
    },
    chip: {
      borderWidth: 1,
      borderColor: outlineColor,
      borderRadius: 999,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 5,
      backgroundColor: colors.surface,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "600",
    },
    chipTextActive: {
      color: colors.primaryText,
    },
    resetInlineButton: {
      borderWidth: 1,
      borderColor: outlineColor,
      borderRadius: 999,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 5,
      backgroundColor: colors.surface,
    },
    resetInlineButtonText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    buttonDisabled: {
      opacity: 0.55,
    },
    resultText: {
      color: colors.mutedText,
      fontSize: 13,
    },
    emptyText: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
    },
    postsSection: {
      gap: SPACING.sm,
    },
    postsStack: {
      gap: SPACING.sm,
    },
    postCard: {
      borderWidth: 1,
      borderColor: outlineColor,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    postCardContent: {
      padding: SPACING.sm + 2,
    },
    postCardContentDisabled: {
      opacity: 0.88,
    },
    postMainRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.sm,
    },
    postContentColumn: {
      flex: 1,
      gap: 6,
    },
    thumbnail: {
      width: 88,
      height: 88,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.surfaceMuted,
    },
    postTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: SPACING.sm,
    },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: SPACING.xs,
      flex: 1,
    },
    categoryBadge: {
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: 999,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      backgroundColor: colors.accentSoft,
      color: colors.accent,
      fontSize: 11,
      fontWeight: "700",
    },
    postTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 21,
    },
    postSummary: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
    },
    postMeta: {
      color: colors.mutedText,
      fontSize: 11,
    },
    statusBadge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
    },
    statusBadgePublished: {
      borderColor: colors.successBorder,
      backgroundColor: colors.successSoft,
    },
    statusBadgeDraft: {
      borderColor: colors.warningBorder,
      backgroundColor: colors.warningSoft,
    },
    statusBadgePending: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
    },
    statusBadgeTrashed: {
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    statusBadgeTextPublished: {
      color: colors.success,
    },
    statusBadgeTextDraft: {
      color: colors.warning,
    },
    statusBadgeTextPending: {
      color: colors.accent,
    },
    statusBadgeTextTrashed: {
      color: colors.danger,
    },
    cardActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      borderTopWidth: 1,
      borderTopColor: outlineColor,
      padding: SPACING.sm + 2,
      backgroundColor: colors.surfaceMuted,
    },
    secondaryButton: {
      minHeight: 38,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.sm,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
    },
    deleteButton: {
      minHeight: 38,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.dangerSoft,
      paddingHorizontal: SPACING.sm,
    },
    deleteButtonText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
    },
    actionButton: {
      flex: 1,
      minHeight: 38,
      minWidth: 0,
    },
  });
};
