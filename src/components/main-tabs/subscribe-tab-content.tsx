import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BookmarkMenuIcon } from "@/components/icons/bookmark-menu-icon";
import { MoreVerticalIcon } from "@/components/icons/more-vertical-icon";
import { SubscribeTabIcon } from "@/components/icons/subscribe-tab-icon";
import { UnfollowActionIcon } from "@/components/icons/unfollow-action-icon";
import { MainTabScrollView } from "@/components/main-tabs/main-tab-scroll-view";
import { useAuthorFollows } from "@/hooks/use-author-follows";
import { useFavorites } from "@/hooks/use-favorites";
import {
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import { createSlug, getPostCardThumbnailUrl, type PostRecord } from "@/lib/content";
import { formatRelativeTime } from "@/lib/relative-time";
import {
  DEFAULT_OFFLINE_MESSAGE,
  getActionErrorMessage,
} from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useMainTabData } from "@/providers/main-tab-data-provider";
import { useAppTheme } from "@/providers/theme-provider";

type SubscribedAuthorSummary = {
  id: string;
  displayName: string;
  username: string;
  photoURL: string;
  latestPublishedAt: string;
  postCount: number;
};

const getAuthorFallbackLabel = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized.charAt(0).toUpperCase() : "A";
};

const ALL_CATEGORY_FILTER = "all";

export function SubscribeTabContent() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { publishedPosts, isLoadingPosts, postsError } = useMainTabData();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const {
    authorFollows,
    authorFollowsError,
    followedAuthorIds,
    isFollowingAuthor,
    isLoadingAuthorFollows,
    toggleAuthorFollow,
  } = useAuthorFollows();
  const { isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();
  const styles = createStyles(colors);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY_FILTER);
  const [menuPost, setMenuPost] = useState<PostRecord | null>(null);

  const subscribedPosts = useMemo(
    () =>
      publishedPosts.filter((post) =>
        followedAuthorIds.has(post.authorId || post.createdBy),
      ),
    [followedAuthorIds, publishedPosts],
  );

  const subscribedAuthors = useMemo(() => {
    const postStatsByAuthor = new Map<string, SubscribedAuthorSummary>();

    subscribedPosts.forEach((post) => {
      const authorId = post.authorId || post.createdBy;
      if (!authorId) {
        return;
      }

      const currentValue = postStatsByAuthor.get(authorId);
      const nextPublishedAt = post.publishedAt || post.uploadDate || post.createDate;
      const currentPublishedAt = currentValue?.latestPublishedAt || "";
      const shouldUseNextTimestamp =
        !currentPublishedAt ||
        Date.parse(nextPublishedAt || "") > Date.parse(currentPublishedAt || "");

      postStatsByAuthor.set(authorId, {
        id: authorId,
        displayName: post.authorDisplayName || currentValue?.displayName || "Author",
        username: post.authorUsername || currentValue?.username || "",
        photoURL:
          shouldUseNextTimestamp
            ? post.authorPhotoURL || currentValue?.photoURL || ""
            : currentValue?.photoURL || post.authorPhotoURL || "",
        latestPublishedAt: shouldUseNextTimestamp ? nextPublishedAt : currentPublishedAt,
        postCount: (currentValue?.postCount || 0) + 1,
      });
    });

    const authorsWithPosts = Array.from(postStatsByAuthor.values()).sort((left, right) => {
      const leftTime = Date.parse(left.latestPublishedAt || "");
      const rightTime = Date.parse(right.latestPublishedAt || "");
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    });

    const remainingFollowedAuthors = authorFollows
      .filter((item) => !postStatsByAuthor.has(item.authorId))
      .map<SubscribedAuthorSummary>((item) => ({
        id: item.authorId,
        displayName: item.authorDisplayName || item.authorUsername || "Author",
        username: item.authorUsername,
        photoURL: "",
        latestPublishedAt: "",
        postCount: 0,
      }));

    return [...authorsWithPosts, ...remainingFollowedAuthors];
  }, [authorFollows, subscribedPosts]);
  const categoryFilters = useMemo(() => {
    const categories = new Map<string, string>();

    subscribedPosts.forEach((post) => {
      const slug = createSlug(post.category);
      if (slug && !categories.has(slug)) {
        categories.set(slug, post.category);
      }
    });

    return [
      { id: ALL_CATEGORY_FILTER, label: "All" },
      ...Array.from(categories.entries()).map(([id, label]) => ({
        id,
        label,
      })),
    ];
  }, [subscribedPosts]);
  const filteredPosts = useMemo(() => {
    if (selectedCategory === ALL_CATEGORY_FILTER) {
      return subscribedPosts;
    }

    return subscribedPosts.filter((post) => createSlug(post.category) === selectedCategory);
  }, [selectedCategory, subscribedPosts]);

  const isLoading = isLoadingPosts || isLoadingAuthorFollows;
  const combinedError = postsError || authorFollowsError;
  const isOfflineState = !isConnected || combinedError === DEFAULT_OFFLINE_MESSAGE;
  const showInlineError = Boolean(combinedError) && !isOfflineState;

  useEffect(() => {
    if (categoryFilters.some((item) => item.id === selectedCategory)) {
      return;
    }

    setSelectedCategory(ALL_CATEGORY_FILTER);
  }, [categoryFilters, selectedCategory]);

  const openPost = (post: PostRecord) => {
    const swipeAuthorId = post.authorId || post.createdBy;

    router.push({
      pathname: "/post/[postId]",
      params: {
        postId: post.id,
        swipeSource: "author",
        swipeAuthorId,
      },
    });
  };

  const openAuthorProfile = (authorId: string) => {
    if (!authorId) {
      return;
    }

    router.push({
      pathname: "/author/[authorId]",
      params: { authorId },
    });
  };

  const handleToggleFavorite = async (post: PostRecord) => {
    try {
      await toggleFavorite(post);
    } catch (toggleError) {
      const message = getActionErrorMessage({
        error: toggleError,
        isConnected,
        fallbackMessage: "Bookmarks could not be updated right now.",
      });

      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
        return;
      }

      Alert.alert("Unable to update bookmarks", message);
    }
  };
  const closeCardMenu = () => {
    setMenuPost(null);
  };
  const openCardMenu = (post: PostRecord) => {
    setMenuPost(post);
  };
  const handleToggleAuthorFollow = async (post: PostRecord) => {
    const authorId = post.authorId || post.createdBy;

    if (!authorId || !isFollowingAuthor(authorId)) {
      return;
    }

    try {
      await toggleAuthorFollow({
        uid: authorId,
        displayName: post.authorDisplayName || post.createdByEmail || "Author",
        username: post.authorUsername,
      });
      closeCardMenu();
    } catch (toggleError) {
      const message = getActionErrorMessage({
        error: toggleError,
        isConnected,
        fallbackMessage: "Author follow could not be updated right now.",
      });

      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
        return;
      }

      Alert.alert("Unable to update follow", message);
    }
  };
  const handleConfirmUnfollow = (post: PostRecord) => {
    const authorName = post.authorDisplayName || "this author";

    closeCardMenu();
    Alert.alert(
      `Unsubscribe from ${authorName}?`,
      "",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Unfollow",
          style: "destructive",
          onPress: () => {
            void handleToggleAuthorFollow(post);
          },
        },
      ],
    );
  };

  const renderEmptyState = () => {
    let title = "No subscriptions yet";
    let body = "Follow creators and their latest posts will appear here.";

    if (!user?.uid) {
      title = "Sign in to continue";
      body = "Login to see a feed built from the creators you follow.";
    } else if (selectedCategory !== ALL_CATEGORY_FILTER && subscribedPosts.length > 0) {
      title = "No uploads in this category";
      body = "Try another category filter to see more posts.";
    } else if (authorFollows.length > 0) {
      title = "No uploads yet";
      body = "Your subscribed creators have not published anything yet.";
    }

    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconCard}>
          <SubscribeTabIcon size={30} color={colors.mutedText} />
        </View>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{body}</Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <MainTabScrollView
        tabName="subscribe"
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {subscribedAuthors.length ? (
          <View style={styles.channelsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Followed Creators</Text>
              <Text style={styles.sectionMeta}>
                {`${subscribedAuthors.length} creator${subscribedAuthors.length === 1 ? "" : "s"}`}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.channelRail}
            >
              {subscribedAuthors.map((author) => {
                const latestAuthorLabel = author.latestPublishedAt
                  ? formatRelativeTime(author.latestPublishedAt)
                  : "Following";

                return (
                  <Pressable
                    key={author.id}
                    style={({ pressed }) => [
                      styles.channelCard,
                      pressed && styles.channelCardPressed,
                    ]}
                    onPress={() => openAuthorProfile(author.id)}
                  >
                    {author.photoURL ? (
                      <Image source={{ uri: author.photoURL }} style={styles.channelAvatar} />
                    ) : (
                      <View style={[styles.channelAvatar, styles.channelAvatarFallback]}>
                        <Text style={styles.channelAvatarText}>
                          {getAuthorFallbackLabel(author.displayName)}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.channelName} numberOfLines={1}>
                      {author.displayName}
                    </Text>
                    <Text style={styles.channelMeta} numberOfLines={1}>
                      {author.postCount ? `${author.postCount} upload${author.postCount === 1 ? "" : "s"}` : latestAuthorLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {!isLoading && !showInlineError && subscribedPosts.length ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Latest Uploads</Text>
              <Text style={styles.sectionMeta}>Subscriptions queue</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChipRail}
            >
              {categoryFilters.map((item) => {
                const active = item.id === selectedCategory;

                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.categoryChip,
                      active && styles.categoryChipActive,
                      pressed && styles.categoryChipPressed,
                    ]}
                    onPress={() => setSelectedCategory(item.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        active && styles.categoryChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : null}

        {!isLoading && showInlineError ? (
          <Text style={styles.errorText}>{combinedError}</Text>
        ) : null}

        {!isLoading && !showInlineError && !filteredPosts.length ? renderEmptyState() : null}

        {!isLoading && !showInlineError
          ? filteredPosts.map((post) => {
            const thumbnailUrl = getPostCardThumbnailUrl(post);
            const authorLabel = post.authorDisplayName || "Community Author";
            const publishedLabel = formatRelativeTime(
              post.publishedAt || post.uploadDate || post.createDate,
            );

            return (
              <Pressable
                key={post.id}
                style={({ pressed }) => [
                  styles.videoCard,
                  pressed && styles.videoCardPressed,
                ]}
                onPress={() => openPost(post)}
              >
                {thumbnailUrl ? (
                  <Image
                    source={{ uri: thumbnailUrl }}
                    style={styles.videoThumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.videoThumbnailFallback}>
                    <SubscribeTabIcon size={24} color={colors.mutedText} />
                  </View>
                )}

                <View style={styles.videoMetaRow}>
                  {post.authorPhotoURL ? (
                    <Image source={{ uri: post.authorPhotoURL }} style={styles.videoAvatar} />
                  ) : (
                    <View style={[styles.videoAvatar, styles.videoAvatarFallback]}>
                      <Text style={styles.videoAvatarText}>
                        {getAuthorFallbackLabel(authorLabel)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.videoTextWrap}>
                    <Text style={styles.videoTitle} numberOfLines={2} ellipsizeMode="tail">
                      {post.title}
                    </Text>
                    <Text style={styles.videoMetaText} numberOfLines={2}>
                      {`${authorLabel} • ${publishedLabel || "-"}`}
                    </Text>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.menuButton,
                      pressed && styles.menuButtonPressed,
                    ]}
                    onPress={(event) => {
                      event.stopPropagation();
                      openCardMenu(post);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Open actions for ${post.title}`}
                  >
                    <MoreVerticalIcon color={colors.text} size={22} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })
          : null}
      </MainTabScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(menuPost)}
        onRequestClose={closeCardMenu}
      >
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={closeCardMenu} />

            <View style={styles.sheetCard}>
              <View style={styles.sheetHandle} />

            <Pressable
              style={({ pressed }) => [
                styles.sheetAction,
                pressed && styles.sheetActionPressed,
              ]}
              onPress={() => {
                if (!menuPost) {
                  return;
                }

                closeCardMenu();
                void handleToggleFavorite(menuPost);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                menuPost && isFavorite(menuPost.id)
                  ? "Remove from bookmarks"
                  : "Save to bookmarks"
              }
            >
              <View style={styles.sheetActionIconWrap}>
                <BookmarkMenuIcon
                  color={colors.text}
                  active={Boolean(menuPost && isFavorite(menuPost.id))}
                  size={18}
                />
              </View>
              <Text style={styles.sheetActionTitle}>
                {menuPost && isFavorite(menuPost.id)
                  ? "Remove bookmark"
                  : "Add bookmark"}
              </Text>
            </Pressable>

            <View style={styles.sheetActionDivider} />

            <Pressable
              style={({ pressed }) => [
                styles.sheetAction,
                pressed && styles.sheetActionPressed,
              ]}
              onPress={() => {
                if (!menuPost) {
                  return;
                }

                handleConfirmUnfollow(menuPost);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                menuPost
                  ? `Unfollow ${menuPost.authorDisplayName || "author"}`
                  : "Unfollow author"
              }
            >
              <View style={styles.sheetActionIconWrap}>
                <UnfollowActionIcon color={colors.text} size={18} />
              </View>
              <Text style={styles.sheetActionTitle}>Unfollow author</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    container: {
      flexGrow: 1,
      padding: SPACING.xl,
      gap: SPACING.xxl,
      backgroundColor: colors.background,
      paddingBottom: SPACING.xxl * 2,
    },
    countPill: {
      minWidth: 38,
      height: 38,
      paddingHorizontal: SPACING.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    countPillText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    channelsSection: {
      gap: SPACING.md,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
    },
    sectionTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    sectionMeta: {
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    categoryChipRail: {
      gap: SPACING.sm,
      paddingRight: SPACING.xl,
      paddingTop: 2,
    },
    categoryChip: {
      height: 36,
      paddingHorizontal: SPACING.md,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryChipActive: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    categoryChipPressed: {
      opacity: 0.84,
    },
    categoryChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    categoryChipTextActive: {
      color: colors.primaryText,
    },
    channelRail: {
      gap: SPACING.sm,
      paddingRight: SPACING.xl,
    },
    channelCard: {
      width: 94,
      alignItems: "center",
      gap: SPACING.xs,
      paddingVertical: SPACING.sm,
    },
    channelCardPressed: {
      opacity: 0.8,
    },
    channelAvatar: {
      width: 68,
      height: 68,
      borderRadius: 999,
      backgroundColor: colors.surfaceSoft,
    },
    channelAvatarFallback: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    channelAvatarText: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "700",
    },
    channelName: {
      width: "100%",
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
    },
    channelMeta: {
      width: "100%",
      color: colors.mutedText,
      fontSize: 11,
      textAlign: "center",
    },
    loader: {
      marginVertical: SPACING.md,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
    },
    emptyWrap: {
      minHeight: 320,
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.sm,
      borderRadius: RADIUS.lg,
      padding: SPACING.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...SHADOWS.sm,
    },
    emptyIconCard: {
      width: 60,
      height: 60,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    emptyText: {
      color: colors.mutedText,
      fontSize: 13,
      textAlign: "center",
      lineHeight: 20,
    },
    videoCard: {
      gap: SPACING.md,
    },
    videoCardPressed: {
      opacity: 0.92,
    },
    videoThumbnail: {
      width: "100%",
      aspectRatio: 16 / 9,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surfaceSoft,
    },
    videoThumbnailFallback: {
      width: "100%",
      aspectRatio: 16 / 9,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    videoMetaRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.md,
      paddingHorizontal: 2,
      paddingRight: SPACING.xs,
    },
    videoAvatar: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.surfaceSoft,
      marginTop: 1,
    },
    videoAvatarFallback: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    videoAvatarText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    videoTextWrap: {
      flex: 1,
      gap: SPACING.xs,
      paddingTop: 1,
      paddingRight: SPACING.xs,
    },
    videoTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 22,
    },
    videoMetaText: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
      lineHeight: 19,
    },
    menuButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginTop: -6,
      flexShrink: 0,
    },
    menuButtonPressed: {
      opacity: 0.84,
    },
    sheetRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheetBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    sheetCard: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.xxl,
      gap: 0,
      ...SHADOWS.lg,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 48,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.border,
      marginBottom: SPACING.md,
    },
    sheetAction: {
      minHeight: 64,
      paddingHorizontal: 2,
      paddingVertical: SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      justifyContent: "flex-start",
      backgroundColor: colors.surface,
    },
    sheetActionPressed: {
      opacity: 0.72,
    },
    sheetActionIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      flexShrink: 0,
    },
    sheetActionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 48,
    },
    sheetActionTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
  });
