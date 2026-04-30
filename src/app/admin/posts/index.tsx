import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Redirect, Stack, useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import {
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import {
  POSTS_COLLECTION,
  formatDate,
  getContentPreviewLines,
  getPostCardThumbnailUrl,
  isPostTrashed,
  mapPostRecord,
  sortPostsByRecency,
  type PostRecord,
  type PostStatus,
} from "@/lib/content";
import { ArrowRightIcon } from "@/components/icons/arrow-right-icon";
import { MoreVerticalIcon } from "@/components/icons/more-vertical-icon";
import { PlusIcon } from "@/components/icons/plus-icon";
import { SearchInputIcon } from "@/components/icons/search-input-icon";
import { TrashActionIcon } from "@/components/icons/trash-action-icon";
import { firestore } from "@/lib/firebase";
import { getActionErrorMessage, getRequestErrorMessage } from "@/lib/network";
import { notifyPostPublishedAsync } from "@/lib/notifications";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

type PostsTabKey = "published" | "pending" | "draft" | "trash";
type SearchFilterKey = "all" | "title" | "content" | "category" | "author" | "status";
type PostActionItem = {
  key: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
};
type PostActionMenuState = {
  post: PostRecord;
  anchorX: number;
  anchorY: number;
};

const SEARCH_FILTER_OPTIONS: { key: SearchFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "title", label: "Title" },
  { key: "content", label: "Content" },
  { key: "category", label: "Category" },
  { key: "author", label: "Author" },
  { key: "status", label: "Status" },
];
const POST_ACTION_MENU_WIDTH = 188;
const POST_ACTION_MENU_ITEM_HEIGHT = 50;
const POST_ACTION_MENU_OFFSET = 8;

export default function AdminPostsListScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { isConnected, showToast } = useNetworkStatus();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const { canManagePosts, canModeratePosts, role, user } = useAuth();
  const styles = createStyles(colors, resolvedTheme);

  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<PostsTabKey>("published");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchFilterKey, setSearchFilterKey] = useState<SearchFilterKey>("all");
  const [isSearchFilterMenuOpen, setIsSearchFilterMenuOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<PostActionMenuState | null>(null);

  useEffect(() => {
    setIsLoadingPosts(true);

    if (!canModeratePosts && !user?.uid) {
      setPosts([]);
      setIsLoadingPosts(false);
      return;
    }

    const postsQuery = canModeratePosts
      ? query(collection(firestore, POSTS_COLLECTION))
      : query(
          collection(firestore, POSTS_COLLECTION),
          where("createdBy", "==", user?.uid ?? ""),
        );

    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        setPosts(
          sortPostsByRecency(
            snapshot.docs.map((item) =>
              mapPostRecord(item.id, item.data() as DocumentData),
            ),
          ),
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
      },
    );

    return () => {
      unsubscribePosts();
    };
  }, [canModeratePosts, isConnected, user?.uid]);

  const scopedPosts = useMemo(() => {
    if (canModeratePosts) {
      return posts;
    }

    if (!user?.uid) {
      return [];
    }

    return posts.filter(
      (post) =>
        post.createdBy === user.uid ||
        (!!user.email && post.createdByEmail === user.email),
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

  const tabCounts = useMemo(
    () => ({
      published: activePosts.filter((post) => post.status === "published").length,
      pending: activePosts.filter((post) => post.status === "pending").length,
      draft: activePosts.filter((post) => post.status === "draft").length,
      trash: trashedPosts.length,
    }),
    [activePosts, trashedPosts.length],
  );

  const activeTabSourceCount = useMemo(() => {
    if (activeTab === "trash") {
      return tabCounts.trash;
    }

    if (activeTab === "draft") {
      return tabCounts.draft;
    }

    if (activeTab === "pending") {
      return tabCounts.pending;
    }

    return tabCounts.published;
  }, [activeTab, tabCounts.draft, tabCounts.pending, tabCounts.published, tabCounts.trash]);

  const filteredPosts = useMemo(() => {
    const sourcePosts = activeTab === "trash" ? trashedPosts : activePosts;
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    return sourcePosts.filter((post) => {
      if (activeTab === "published" && post.status !== "published") {
        return false;
      }

      if (activeTab === "draft" && post.status !== "draft") {
        return false;
      }

      if (activeTab === "pending" && post.status !== "pending") {
        return false;
      }

      if (normalizedSearchQuery) {
        const statusSearchText = [
          post.status,
          post.status === "pending" ? "pending review" : "",
          isPostTrashed(post) ? "trash trashed recycle bin" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const searchableTextByFilter = {
          all: [
            post.title,
            post.slug,
            post.content,
            post.category,
            post.authorDisplayName,
            post.authorUsername,
            post.createdByEmail,
            statusSearchText,
          ],
          title: [post.title, post.slug],
          content: [post.content],
          category: [post.category],
          author: [post.authorDisplayName, post.authorUsername, post.createdByEmail],
          status: [statusSearchText],
        } as const;
        const searchableText = searchableTextByFilter[searchFilterKey]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(normalizedSearchQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [activePosts, activeTab, searchFilterKey, searchQuery, trashedPosts]);

  const activeTabHeading = useMemo(() => {
    if (activeTab === "draft") {
      return "Draft Posts";
    }

    if (activeTab === "pending") {
      return "Pending Review Posts";
    }

    if (activeTab === "trash") {
      return "Trash Posts";
    }

    return "Published Posts";
  }, [activeTab]);

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
      await setDoc(
        doc(firestore, POSTS_COLLECTION, post.id),
        {
          status: nextStatus,
          uploadDate: serverTimestamp(),
          submittedAt:
            nextStatus === "published"
              ? post.submittedAt || serverTimestamp()
              : null,
          publishedAt: nextStatus === "published" ? serverTimestamp() : null,
          approvedAt: nextStatus === "published" ? serverTimestamp() : null,
          approvedBy: nextStatus === "published" ? user?.uid ?? "" : null,
          approvedByEmail:
            nextStatus === "published" ? user?.email ?? "" : null,
        },
        { merge: true },
      );

      setSuccess(
        nextStatus === "published"
          ? "Post approved and published."
          : "Post moved back to draft.",
      );

      if (nextStatus === "published" && post.status !== "published") {
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
        { merge: true },
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
        { merge: true },
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
        { merge: true },
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
    Alert.alert(
      "Delete Permanently",
      `Delete "${post.title}" permanently? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void runDeletePostPermanently(post);
          },
        },
      ],
    );
  };

  const getPostActionItems = (post: PostRecord): PostActionItem[] => {
    if (isPostTrashed(post)) {
      return [
        {
          key: "restore",
          label: "Restore",
          onPress: () => {
            void runRestorePost(post);
          },
        },
        {
          key: "delete-forever",
          label: "Delete Forever",
          destructive: true,
          onPress: () => {
            handleDeletePostPermanently(post);
          },
        },
      ];
    }

    if (canModeratePosts) {
      return [
        {
          key: "edit",
          label: "Edit",
          onPress: () => {
            router.push(`/admin/posts/edit?postId=${post.id}`);
          },
        },
        {
          key: "publish-toggle",
          label:
            post.status === "published"
              ? "Move to Draft"
              : post.status === "pending"
                ? "Approve & Publish"
                : "Publish",
          onPress: () => {
            void handleModeratePost(
              post,
              post.status === "published" ? "draft" : "published",
            );
          },
        },
        {
          key: "move-trash",
          label: "Move to Trash",
          destructive: true,
          onPress: () => {
            handleMovePostToRecycleBin(post);
          },
        },
      ];
    }

    const baseActions: PostActionItem[] = [
      {
        key: "edit",
        label: "Edit",
        onPress: () => {
          router.push(`/admin/posts/edit?postId=${post.id}`);
        },
      },
    ];

    if (post.status === "draft") {
      baseActions.push({
        key: "submit-review",
        label: "Submit for Review",
        onPress: () => {
          void handleSubmitForReview(post);
        },
      });
    }

    baseActions.push({
      key: "move-trash",
      label: "Move to Trash",
      destructive: true,
      onPress: () => {
        handleMovePostToRecycleBin(post);
      },
    });

    return baseActions;
  };

  const tabs: { key: PostsTabKey; label: string; count: number }[] = [
    { key: "published", label: "Published", count: tabCounts.published },
    { key: "pending", label: "Pending", count: tabCounts.pending },
    { key: "draft", label: "Draft", count: tabCounts.draft },
    { key: "trash", label: "Trash", count: tabCounts.trash },
  ];

  const hasActiveSearch = Boolean(searchQuery.trim());
  const activeTabLabel = tabs.find((tab) => tab.key === activeTab)?.label ?? "Published";
  const isAnyMenuOpen = isStatusMenuOpen;
  const activeSearchFilterLabel = SEARCH_FILTER_OPTIONS.find((item) => item.key === searchFilterKey)?.label ?? "All";
  const postActionMenuItems = activeActionMenu
    ? getPostActionItems(activeActionMenu.post)
    : [];
  const postActionMenuHeight =
    postActionMenuItems.length * POST_ACTION_MENU_ITEM_HEIGHT +
    Math.max(0, postActionMenuItems.length - 1) * StyleSheet.hairlineWidth;
  const postActionMenuLeft = activeActionMenu
    ? Math.min(
        windowWidth - POST_ACTION_MENU_WIDTH - SPACING.lg,
        Math.max(
          SPACING.lg,
          activeActionMenu.anchorX - POST_ACTION_MENU_WIDTH + 24,
        ),
      )
    : SPACING.lg;
  const postActionMenuTop = activeActionMenu
    ? (() => {
        const preferredTop = activeActionMenu.anchorY + POST_ACTION_MENU_OFFSET;
        if (preferredTop + postActionMenuHeight <= windowHeight - SPACING.lg) {
          return preferredTop;
        }

        return Math.max(
          SPACING.lg,
          activeActionMenu.anchorY - postActionMenuHeight - POST_ACTION_MENU_OFFSET,
        );
      })()
    : SPACING.lg;

  const closeAllMenus = () => {
    setIsStatusMenuOpen(false);
    setIsSearchFilterMenuOpen(false);
    setActiveActionMenu(null);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: "Posts",
          headerRight: () => (
            <View style={styles.headerActionsRow}>
              <Pressable
                style={styles.headerActionButton}
                onPress={() => {
                  closeAllMenus();
                  router.push("/admin/posts/edit");
                }}
                accessibilityRole="button"
                accessibilityLabel="Add new post"
              >
                <PlusIcon color={colors.text} size={20} />
              </Pressable>
              <Pressable
                style={styles.headerActionButton}
                onPress={() => {
                  setIsSearchOpen((current) => {
                    const nextValue = !current;
                    setIsSearchFilterMenuOpen(nextValue);
                    setIsStatusMenuOpen(false);
                    return nextValue;
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={isSearchOpen ? "Close search" : "Open search"}
              >
                <SearchInputIcon color={colors.text} size={22} />
              </Pressable>
            </View>
          ),
        }}
      />

      {isSearchOpen ? (
        <>
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${activeSearchFilterLabel.toLowerCase()}...`}
              placeholderTextColor={colors.placeholderText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          {isSearchFilterMenuOpen ? (
            <View style={styles.searchFiltersWrap}>
              <Text style={styles.searchFiltersLabel}>Search in</Text>
              <View style={styles.searchFiltersRow}>
                {SEARCH_FILTER_OPTIONS.map((option) => {
                  const isActive = option.key === searchFilterKey;

                  return (
                    <Pressable
                      key={option.key}
                      style={[
                        styles.searchFilterChip,
                        isActive && styles.searchFilterChipActive,
                      ]}
                      onPress={() => {
                        setSearchFilterKey(option.key);
                        setIsStatusMenuOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.searchFilterChipText,
                          isActive && styles.searchFilterChipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      <View style={[styles.headingRow, isStatusMenuOpen && styles.headingRowMenuOpen]}>
        <Text style={styles.headingText}>{activeTabHeading}</Text>

        <View style={styles.dropdownRoot}>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => {
              setIsSearchFilterMenuOpen(false);
              setIsStatusMenuOpen((current) => !current);
            }}
          >
            <Text style={styles.dropdownButtonText}>{activeTabLabel}</Text>
            <Text style={styles.dropdownCaret}>{isStatusMenuOpen ? "▲" : "▼"}</Text>
          </Pressable>

          {isStatusMenuOpen ? (
            <View style={styles.dropdownMenu}>
              {tabs.map((tab) => {
                const isActive = tab.key === activeTab;

                return (
                  <Pressable
                    key={tab.key}
                    style={[styles.dropdownOption, isActive && styles.dropdownOptionActive]}
                    onPress={() => {
                      clearFeedback();
                      setActiveTab(tab.key);
                      setIsStatusMenuOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        isActive && styles.dropdownOptionTextActive,
                      ]}
                    >
                      {`${tab.label} (${tab.count})`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>

      {error ? (
        <View style={[styles.feedbackCard, styles.feedbackCardError]}>
          <Text style={styles.feedbackTextError}>{error}</Text>
        </View>
      ) : null}
      {success ? (
        <View style={[styles.feedbackCard, styles.feedbackCardSuccess]}>
          <Text style={styles.feedbackTextSuccess}>{success}</Text>
        </View>
      ) : null}

      {isLoadingPosts ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Syncing posts...</Text>
        </View>
      ) : null}
      {!isLoadingPosts && hasActiveSearch ? (
        <Text style={styles.resultText}>
          {`Showing ${filteredPosts.length} of ${activeTabSourceCount} posts`}
        </Text>
      ) : null}

      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => {
          closeAllMenus();
        }}
      >
        {!isLoadingPosts && !filteredPosts.length ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No posts found in this tab.
            </Text>
          </View>
        ) : (
          <View style={styles.cardsWrap}>
            {filteredPosts.map((post) => {
              const isTrashed = isPostTrashed(post);
              const updatedLabel = formatDate(
                post.publishedAt || post.uploadDate || post.createDate,
              );
              const thumbnailUrl = getPostCardThumbnailUrl(post);
              const postTitle = post.title.trim() || "Untitled Post";
              const postPreview = getContentPreviewLines(post.content, 1) || "-";
              const statusLabel = isTrashed
                ? "Trashed"
                : post.status === "published"
                  ? "Published"
                  : post.status === "pending"
                    ? "Pending Review"
                    : "Draft";

              return (
                <View key={post.id} style={styles.postCard}>
                  <Pressable
                    style={({ pressed }) => [styles.postCardBody, pressed && styles.postCardBodyPressed]}
                    onPress={
                      isTrashed
                        ? undefined
                        : () => router.push(`/admin/posts/edit?postId=${post.id}`)
                    }
                    disabled={isTrashed}
                  >
                    <View style={styles.postMediaWrap}>
                      {thumbnailUrl ? (
                        <Image
                          source={{ uri: thumbnailUrl }}
                          style={styles.postImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.postImageFallback} />
                      )}
                    </View>

                    <View style={styles.postMetaWrap}>
                      <Text style={styles.postTitle} numberOfLines={2}>
                        {postTitle}
                      </Text>
                      <Text style={styles.postPreview} numberOfLines={1}>
                        {postPreview}
                      </Text>
                      <Text style={styles.postDate}>{`${statusLabel} | ${updatedLabel}`}</Text>
                    </View>
                  </Pressable>
                  <View style={styles.rowMenuWrap}>
                    <Pressable
                      style={({ pressed }) => [styles.rowMenuButton, pressed && styles.rowMenuButtonPressed]}
                      onPress={(event) => {
                        const { pageX, pageY } = event.nativeEvent;
                        setIsSearchFilterMenuOpen(false);
                        setIsStatusMenuOpen(false);
                        setActiveActionMenu({
                          post,
                          anchorX: pageX,
                          anchorY: pageY,
                        });
                      }}
                    >
                      <MoreVerticalIcon color={colors.subtleText} size={20} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {isAnyMenuOpen ? (
        <Pressable
          style={styles.menuBackdrop}
          onPress={closeAllMenus}
          accessibilityRole="button"
          accessibilityLabel="Close open menus"
        />
      ) : null}

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(activeActionMenu)}
        onRequestClose={() => setActiveActionMenu(null)}
      >
        <View style={styles.actionMenuOverlay}>
          <Pressable
            style={styles.actionMenuBackdrop}
            onPress={() => setActiveActionMenu(null)}
          />
          <View
            style={[
              styles.actionMenuDropdown,
              {
                top: postActionMenuTop,
                left: postActionMenuLeft,
              },
            ]}
          >
            {postActionMenuItems.map((action, actionIndex) => (
              <Pressable
                key={action.key}
                style={({ pressed }) => [
                  styles.actionMenuItem,
                  actionIndex > 0 && styles.actionMenuItemWithSeparator,
                  pressed && styles.actionMenuItemPressed,
                ]}
                onPress={() => {
                  setActiveActionMenu(null);
                  requestAnimationFrame(() => {
                    action.onPress();
                  });
                }}
              >
                <View style={styles.postActionItemContent}>
                  <View style={styles.postActionIconWrap}>
                    {action.destructive ? (
                      <TrashActionIcon color={colors.danger} size={14} />
                    ) : (
                      <ArrowRightIcon color={colors.subtleText} size={14} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.postActionItemText,
                      action.destructive && styles.postActionItemTextDestructive,
                    ]}
                  >
                    {action.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors, resolvedTheme: "light" | "dark") => {
  const outlineColor = resolvedTheme === "dark" ? colors.divider : colors.border;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    headerActionButton: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    searchWrap: {
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.lg,
      minHeight: 48,
      justifyContent: "center",
      ...SHADOWS.sm,
    },
    searchInput: {
      color: colors.text,
      fontSize: 15,
      paddingVertical: SPACING.xs,
    },
    searchFiltersWrap: {
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      gap: SPACING.sm,
      ...SHADOWS.sm,
    },
    searchFiltersLabel: {
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    searchFiltersRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm,
    },
    searchFilterChip: {
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    searchFilterChipActive: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
    },
    searchFilterChipText: {
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: "700",
    },
    searchFilterChipTextActive: {
      color: colors.accent,
    },
    headingRow: {
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.md,
      marginBottom: SPACING.xs,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
      zIndex: 12,
    },
    headingRowMenuOpen: {
      position: "relative",
      zIndex: 220,
      elevation: 20,
    },
    headingText: {
      flex: 1,
      color: colors.text,
      fontSize: 22,
      fontWeight: "800",
      lineHeight: 28,
    },
    dropdownRoot: {
      position: "relative",
      zIndex: 20,
    },
    dropdownButton: {
      minWidth: 152,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.sm,
      ...SHADOWS.sm,
    },
    dropdownButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    dropdownCaret: {
      color: colors.mutedText,
      fontSize: 10,
      fontWeight: "700",
    },
    dropdownMenu: {
      position: "absolute",
      top: 52,
      right: 0,
      minWidth: 192,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surface,
      overflow: "hidden",
      ...SHADOWS.md,
      zIndex: 260,
      elevation: 30,
    },
    dropdownOption: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    dropdownOptionActive: {
      backgroundColor: colors.activeSurface,
    },
    dropdownOptionText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    dropdownOptionTextActive: {
      color: colors.accent,
      fontWeight: "700",
    },
    feedbackCard: {
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.md,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderWidth: 1,
    },
    feedbackCardError: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.dangerBorder,
    },
    feedbackCardSuccess: {
      backgroundColor: colors.successSoft,
      borderColor: colors.successBorder,
    },
    feedbackTextError: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 19,
    },
    feedbackTextSuccess: {
      color: colors.success,
      fontSize: 13,
      lineHeight: 19,
    },
    loadingRow: {
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surfaceMuted,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    loadingText: {
      color: colors.mutedText,
      fontSize: 12,
    },
    resultText: {
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.sm,
      color: colors.mutedText,
      fontSize: 13,
    },
    listContainer: {
      flex: 1,
      marginTop: SPACING.md,
    },
    listContent: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.xxl * 3,
      gap: SPACING.lg,
    },
    emptyState: {
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
    },
    emptyText: {
      color: colors.mutedText,
      fontSize: 14,
      lineHeight: 20,
    },
    cardsWrap: {
      gap: SPACING.lg,
    },
    postCard: {
      position: "relative",
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      ...SHADOWS.sm,
    },
    postCardBody: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
    },
    postCardBodyPressed: {
      opacity: 0.92,
    },
    postMediaWrap: {
      width: 84,
      height: 84,
      borderRadius: RADIUS.sm,
      overflow: "hidden",
      backgroundColor: colors.surfaceSoft,
    },
    postImage: {
      width: 84,
      height: 84,
      backgroundColor: colors.surfaceSoft,
    },
    postImageFallback: {
      width: 84,
      height: 84,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: outlineColor,
    },
    postMetaWrap: {
      flex: 1,
      justifyContent: "center",
      gap: 8,
      position: "relative",
    },
    postTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 22,
      paddingRight: 34,
    },
    postPreview: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 18,
    },
    postDate: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
    },
    rowMenuButton: {
      width: 28,
      height: 28,
      borderRadius: 5,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    rowMenuButtonPressed: {
      opacity: 0.88,
    },
    rowMenuWrap: {
      position: "absolute",
      top: SPACING.md,
      right: SPACING.md,
      zIndex: 20,
    },
    actionMenuOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 260,
    },
    actionMenuBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "transparent",
    },
    actionMenuDropdown: {
      position: "absolute",
      width: POST_ACTION_MENU_WIDTH,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surface,
      overflow: "hidden",
      ...SHADOWS.md,
    },
    actionMenuItem: {
      minHeight: 46,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      backgroundColor: colors.surface,
    },
    actionMenuItemWithSeparator: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: outlineColor,
    },
    actionMenuItemPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    postActionItemContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    postActionIconWrap: {
      width: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    postActionItemText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    postActionItemTextDestructive: {
      color: colors.danger,
    },
    menuBackdrop: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 140,
      backgroundColor: "transparent",
    },
  });
};
