import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Stack, useNavigation, useRouter } from "expo-router";
import {
  Alert,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CancelInputIcon } from "@/components/icons/cancel-input-icon";
import { FavoriteActionIcon } from "@/components/icons/favorite-action-icon";
import { SearchInput } from "@/components/search-input";
import { SkeletonBlock } from "@/components/skeleton-block";
import {
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  getFavoriteActionPalette,
  type ThemeColors,
} from "@/constants/theme";
import { useFavorites } from "@/hooks/use-favorites";
import {
  formatDate,
  getContentPreviewLines,
  getPostCardThumbnailUrl,
  matchesPostSearch,
  type PostRecord,
} from "@/lib/content";
import {
  DEFAULT_OFFLINE_MESSAGE,
  getActionErrorMessage,
} from "@/lib/network";
import { useNetworkStatus } from "@/providers/network-provider";
import { useMainTabData } from "@/providers/main-tab-data-provider";
import { useAppTheme } from "@/providers/theme-provider";

const SEARCH_SKELETON_ITEMS = Array.from({ length: 3 }, (_, index) => index);
const MAX_RECENT_SEARCHES = 6;
const RECENT_SEARCHES_STORAGE_KEY = "app:recent_search_terms";
const HEADER_SHADOW_SCROLL_THRESHOLD = 6;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { colors, resolvedTheme } = useAppTheme();
  const { publishedPosts, isLoadingPosts, postsError } = useMainTabData();
  const navigation = useNavigation();
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const favoritePalette = getFavoriteActionPalette(resolvedTheme);
  const styles = createStyles(colors);
  const [searchTerm, setSearchTerm] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [hasHydratedRecentSearches, setHasHydratedRecentSearches] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [dismissedSuggestedSearches, setDismissedSuggestedSearches] = useState<string[]>([]);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const normalizedSearchTerm = searchTerm.trim();
  const hasActiveSearch = Boolean(normalizedSearchTerm);
  const isOfflineState = !isConnected || postsError === DEFAULT_OFFLINE_MESSAGE;
  const showInlineError = Boolean(postsError) && !isOfflineState;
  const filteredPosts = useMemo(
    () => publishedPosts.filter((post) => matchesPostSearch(post, deferredSearchTerm)),
    [deferredSearchTerm, publishedPosts],
  );
  const suggestedSearchTerms = useMemo(() => {
    const uniqueTitles: string[] = [];
    const seenTitles = new Set<string>();

    publishedPosts.forEach((post) => {
      const title = post.title.trim();
      if (!title) {
        return;
      }

      const normalizedTitle = title.toLowerCase();
      if (seenTitles.has(normalizedTitle)) {
        return;
      }

      seenTitles.add(normalizedTitle);
      uniqueTitles.push(title);
    });

    return uniqueTitles.slice(0, 3);
  }, [publishedPosts]);

  const addRecentSearch = useCallback((value: string) => {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return;
    }

    setRecentSearches((currentItems) => {
      const nextItems = [
        normalizedValue,
        ...currentItems.filter(
          (item) => item.toLowerCase() !== normalizedValue.toLowerCase(),
        ),
      ];

      return nextItems.slice(0, MAX_RECENT_SEARCHES);
    });
  }, []);

  const removeRecentSearch = useCallback((value: string) => {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
      return;
    }

    setRecentSearches((currentItems) => (
      currentItems.filter((item) => item.trim().toLowerCase() !== normalizedValue)
    ));
  }, []);

  useEffect(() => {
    const hydrateRecentSearches = async () => {
      try {
        const rawValue = await AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
        if (!rawValue) {
          return;
        }

        const parsedValue = JSON.parse(rawValue) as unknown;
        if (!Array.isArray(parsedValue)) {
          return;
        }

        const sanitizedItems = parsedValue
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean);

        if (!sanitizedItems.length) {
          return;
        }

        const uniqueItems: string[] = [];
        const seenItems = new Set<string>();

        sanitizedItems.forEach((item) => {
          const normalizedItem = item.toLowerCase();
          if (seenItems.has(normalizedItem)) {
            return;
          }

          seenItems.add(normalizedItem);
          uniqueItems.push(item);
        });

        setRecentSearches(uniqueItems.slice(0, MAX_RECENT_SEARCHES));
      } catch {
        // Ignore corrupted persistence and keep in-memory defaults.
      } finally {
        setHasHydratedRecentSearches(true);
      }
    };

    void hydrateRecentSearches();
  }, []);

  useEffect(() => {
    if (!hasHydratedRecentSearches) {
      return;
    }

    void AsyncStorage.setItem(
      RECENT_SEARCHES_STORAGE_KEY,
      JSON.stringify(recentSearches),
    ).catch(() => {
      // Ignore persistence write errors to avoid blocking UX.
    });
  }, [hasHydratedRecentSearches, recentSearches]);

  const visibleSuggestedSearchTerms = useMemo(() => {
    if (!dismissedSuggestedSearches.length) {
      return suggestedSearchTerms;
    }

    const dismissedSet = new Set(
      dismissedSuggestedSearches.map((item) => item.trim().toLowerCase()),
    );

    return suggestedSearchTerms.filter(
      (item) => !dismissedSet.has(item.trim().toLowerCase()),
    );
  }, [dismissedSuggestedSearches, suggestedSearchTerms]);
  const hasRecentSearches = recentSearches.length > 0;
  const hasSuggestedSearches = visibleSuggestedSearchTerms.length > 0;
  const searchSectionTitle = hasRecentSearches
    ? "Recent search"
    : hasSuggestedSearches
      ? "Recommended search"
      : "Recent search";

  const persistCurrentSearch = useCallback(() => {
    addRecentSearch(normalizedSearchTerm);
  }, [addRecentSearch, normalizedSearchTerm]);

  const closeSearchPage = useCallback(() => {
    persistCurrentSearch();
    setSearchTerm("");
    router.back();
  }, [persistCurrentSearch, router]);

  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
        closeSearchPage();
        return true;
      });

      return () => {
        backHandler.remove();
      };
    }, [closeSearchPage]),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", () => {
      persistCurrentSearch();
    });

    return unsubscribe;
  }, [navigation, persistCurrentSearch]);

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
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

  const handleScroll = useCallback((offsetY: number) => {
    const nextHasScrolled = offsetY > HEADER_SHADOW_SCROLL_THRESHOLD;
    setHasScrolled((currentValue) => (
      currentValue === nextHasScrolled ? currentValue : nextHasScrolled
    ));
  }, []);

  const dismissSuggestedSearch = useCallback((value: string) => {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
      return;
    }

    setDismissedSuggestedSearches((currentItems) => {
      if (currentItems.some((item) => item.trim().toLowerCase() === normalizedValue)) {
        return currentItems;
      }

      return [...currentItems, value];
    });
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          header: () => (
            <View
              style={[
                styles.headerSearchContainer,
                hasScrolled ? styles.headerSearchContainerScrolled : null,
                {
                  paddingTop: Math.max(insets.top, SPACING.sm),
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <SearchInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search lyrics"
                accessibilityLabel="Search posts"
                autoFocus
                showBackButtonOnFocus
                keepBackButtonVisible
                onBackPress={closeSearchPage}
                backAccessibilityLabel="Back from search"
              />
            </View>
          ),
        }}
      />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: SPACING.lg }]}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => handleScroll(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
        >
          {!hasActiveSearch && hasHydratedRecentSearches ? (
            <View style={styles.recentSearchWrap}>
              <Text style={styles.recentSearchLabel}>{searchSectionTitle}</Text>
              {hasRecentSearches ? (
                <View style={styles.recentSearchList}>
                  {recentSearches.map((item, index) => (
                    <View
                      key={item}
                      style={[
                        styles.recentSearchRow,
                        index < recentSearches.length - 1
                          ? styles.recentSearchRowWithSeparator
                          : null,
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Search ${item}`}
                        style={({ pressed }) => [
                          styles.recentSearchRowMain,
                          pressed ? styles.recentSearchRowMainPressed : null,
                        ]}
                        onPress={() => setSearchTerm(item)}
                      >
                        <Text style={styles.recentSearchRowText}>{item}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${item} from recent search`}
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.recentSearchRowCloseButton,
                          pressed ? styles.recentSearchRowCloseButtonPressed : null,
                        ]}
                        onPress={() => removeRecentSearch(item)}
                      >
                        <CancelInputIcon color={colors.mutedText} size={14} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.recentSearchEmptyWrap}>
                  {hasSuggestedSearches ? (
                    <View style={styles.recentSearchChipsWrap}>
                      {visibleSuggestedSearchTerms.map((item) => (
                        <View
                          key={item}
                          style={styles.searchChip}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Search ${item}`}
                            style={({ pressed }) => [
                              styles.searchChipMain,
                              pressed ? styles.searchChipPressed : null,
                            ]}
                            onPress={() => setSearchTerm(item)}
                          >
                            <Text style={styles.searchChipText}>{item}</Text>
                          </Pressable>
                          <View style={styles.searchChipDivider} />
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${item} from recommended search`}
                            hitSlop={6}
                            style={({ pressed }) => [
                              styles.searchChipCloseButton,
                              pressed ? styles.searchChipCloseButtonPressed : null,
                            ]}
                            onPress={() => dismissSuggestedSearch(item)}
                          >
                            <CancelInputIcon color={colors.mutedText} size={14} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <>
                      <Text style={styles.recentSearchEmptyText}>No recent search</Text>
                      <Text style={styles.recentSearchHintText}>Start typing to search.</Text>
                    </>
                  )}
                </View>
              )}
            </View>
          ) : null}

          {isLoadingPosts
            ? SEARCH_SKELETON_ITEMS.map((item) => (
              <View key={item} style={styles.card}>
                <View style={styles.cardBody}>
                  <SkeletonBlock height={156} borderRadius={RADIUS.md} />
                  <SkeletonBlock width="82%" height={24} />
                  <SkeletonBlock width="68%" height={24} />
                  <SkeletonBlock width="100%" height={16} borderRadius={RADIUS.sm} />
                  <SkeletonBlock width="76%" height={16} borderRadius={RADIUS.sm} />
                </View>

                <View style={styles.cardFooter}>
                  <SkeletonBlock width={92} height={16} borderRadius={RADIUS.sm} />
                </View>
              </View>
            ))
            : null}

          {!isLoadingPosts && showInlineError ? (
            <Text style={styles.errorText}>{postsError}</Text>
          ) : null}

          {hasActiveSearch && !isLoadingPosts && !showInlineError ? (
            <Text style={styles.resultText}>
              {`Showing ${filteredPosts.length} of ${publishedPosts.length} posts`}
            </Text>
          ) : null}

          {hasActiveSearch && !isLoadingPosts && !showInlineError && !filteredPosts.length ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No posts match the current search.</Text>
            </View>
          ) : null}

          {hasActiveSearch && !isLoadingPosts && !showInlineError
            ? filteredPosts.map((post) => {
              const thumbnailUrl = getPostCardThumbnailUrl(post);
              const favorite = isFavorite(post.id);
              const updatedLabel = formatDate(post.uploadDate || post.createDate);
              const previewText = getContentPreviewLines(post.content);

              return (
                <View key={post.id} style={styles.card}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cardBody,
                      pressed && styles.cardBodyPressed,
                    ]}
                    onPress={() => openPost(post.id)}
                  >
                    <View style={styles.mediaWrap}>
                      {thumbnailUrl ? (
                        <Image
                          source={{ uri: thumbnailUrl }}
                          style={styles.thumbnail}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.thumbnailFallback} />
                      )}
                      <Pressable
                        style={({ pressed }) => [
                          styles.favoriteButton,
                          pressed && styles.favoriteButtonPressed,
                        ]}
                        onPress={(event) => {
                          event.stopPropagation();
                          void handleToggleFavorite(post);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={
                          favorite
                            ? `Remove ${post.title} from bookmarks`
                            : `Add ${post.title} to bookmarks`
                        }
                      >
                        <FavoriteActionIcon
                          size={16}
                          color={favoritePalette.color}
                          filled={favorite}
                          fillColor={favoritePalette.fillColor}
                          accentColor={favoritePalette.accentColor}
                          accentUnderlayColor={favoritePalette.accentUnderlayColor}
                        />
                      </Pressable>
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={3} ellipsizeMode="tail">
                      {post.title}
                    </Text>
                    <Text
                      style={styles.cardPreview}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {previewText}
                    </Text>
                  </Pressable>

                  <View style={styles.cardFooter}>
                    <Text style={styles.meta}>{`Updated ${updatedLabel}`}</Text>
                  </View>
                </View>
              );
            })
            : null}
        </ScrollView>
      </View>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xxl,
    gap: SPACING.xl,
    backgroundColor: colors.surface,
  },
  headerSearchContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.md,
  },
  headerSearchContainerScrolled: {
    ...SHADOWS.sm,
  },
  recentSearchWrap: {
    paddingHorizontal: SPACING.sm,
    gap: SPACING.md,
  },
  recentSearchLabel: {
    fontSize: 13,
    color: colors.mutedText,
    fontWeight: "600",
  },
  recentSearchChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  recentSearchList: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  recentSearchRow: {
    width: "100%",
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
    gap: SPACING.sm,
  },
  recentSearchRowWithSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recentSearchRowMain: {
    flex: 1,
    paddingVertical: SPACING.md,
  },
  recentSearchRowMainPressed: {
    opacity: 0.82,
  },
  recentSearchRowText: {
    color: colors.text,
    fontSize: 14,
  },
  recentSearchRowCloseButton: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  recentSearchRowCloseButtonPressed: {
    opacity: 0.74,
  },
  searchChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    minHeight: 34,
    maxWidth: "96%",
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: SPACING.xs,
  },
  searchChipMain: {
    maxWidth: "88%",
    paddingVertical: SPACING.sm,
  },
  searchChipPressed: {
    opacity: 0.82,
  },
  searchChipText: {
    color: colors.text,
    fontSize: 13,
  },
  searchChipDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.border,
  },
  searchChipCloseButton: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  searchChipCloseButtonPressed: {
    opacity: 0.74,
  },
  recentSearchEmptyText: {
    color: colors.mutedText,
    fontSize: 14,
  },
  recentSearchEmptyWrap: {
    gap: SPACING.sm,
  },
  recentSearchHintText: {
    color: colors.subtleText,
    fontSize: 12,
  },
  card: {
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  cardBody: {
    gap: SPACING.sm,
  },
  cardBodyPressed: {
    opacity: 0.92,
  },
  mediaWrap: {
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: 156,
    borderRadius: RADIUS.md,
    backgroundColor: colors.surfaceSoft,
  },
  thumbnailFallback: {
    width: "100%",
    height: 156,
    borderRadius: RADIUS.md,
    backgroundColor: colors.surfaceSoft,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 23,
  },
  cardPreview: {
    fontSize: FONT_SIZE.body,
    color: colors.mutedText,
    lineHeight: 21,
  },
  cardFooter: {
    marginTop: SPACING.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  favoriteButton: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    width: 32,
    height: 32,
    backgroundColor: colors.favoriteSurface,
    ...SHADOWS.lg,
  },
  favoriteButtonPressed: {
    opacity: 0.85,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  resultText: {
    color: colors.mutedText,
    fontSize: 13,
  },
  emptyWrap: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: SPACING.lg,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 14,
    textAlign: "center",
  },
  meta: {
    fontSize: 12,
    color: colors.mutedText,
  },
});
