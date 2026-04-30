import { useMemo } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MainTabScrollView } from "@/components/main-tabs/main-tab-scroll-view";
import { SkeletonBlock } from "@/components/skeleton-block";
import {
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import { DEFAULT_OFFLINE_MESSAGE } from "@/lib/network";
import { useNetworkStatus } from "@/providers/network-provider";
import { useMainTabData } from "@/providers/main-tab-data-provider";
import { useAppTheme } from "@/providers/theme-provider";

const CATEGORY_SKELETON_ITEMS = Array.from({ length: 4 }, (_, index) => index);

const normalizeCategoryKey = (value: string) => value.trim().toLowerCase();

export function CategoriesTabContent() {
  const { colors } = useAppTheme();
  const {
    categories,
    publishedPosts,
    isLoadingCategories,
    isLoadingPosts,
    categoriesError,
    postsError,
  } = useMainTabData();
  const { isConnected } = useNetworkStatus();
  const router = useRouter();
  const styles = createStyles(colors);
  const error = categoriesError || postsError;
  const isOfflineState = !isConnected || error === DEFAULT_OFFLINE_MESSAGE;
  const showInlineError = Boolean(error) && !isOfflineState;
  const isLoading = isLoadingCategories || isLoadingPosts;

  const postCountsByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    publishedPosts.forEach((post) => {
      const key = normalizeCategoryKey(post.category);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [publishedPosts]);
  const subtitle = "Tap a category to see all of its published posts on the next screen.";

  const openCategory = (categorySlug: string) => {
    router.push({ pathname: "/category/[categorySlug]", params: { categorySlug } });
  };

  return (
    <View style={styles.screen}>
      <MainTabScrollView tabName="categories" contentContainerStyle={styles.container}>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {showInlineError ? <Text style={styles.error}>{error}</Text> : null}

        {isLoading ? (
          <View style={styles.grid}>
            {CATEGORY_SKELETON_ITEMS.map((item) => (
              <View key={item} style={styles.categoryCard}>
                <SkeletonBlock width="72%" height={20} borderRadius={RADIUS.sm} />
                <SkeletonBlock width="52%" height={14} borderRadius={RADIUS.sm} />
                <SkeletonBlock width={70} height={16} borderRadius={RADIUS.sm} />
              </View>
            ))}
          </View>
        ) : null}

        {!isLoading && !categories.length ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No categories found.</Text>
          </View>
        ) : null}

        {!!categories.length ? (
          <View style={styles.grid}>
            {categories.map((item) => {
              const categoryKey = normalizeCategoryKey(item.slug);
              const postCount = postCountsByCategory.get(categoryKey) ?? 0;

              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.categoryCard,
                    pressed && styles.categoryCardPressed,
                  ]}
                  onPress={() => openCategory(item.slug)}
                >
                  <Text style={styles.categoryName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.categorySlug} numberOfLines={1}>
                    {item.slug}
                  </Text>
                  <Text style={styles.categoryCount}>
                    {`${postCount} post${postCount === 1 ? "" : "s"}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </MainTabScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: SPACING.xl,
    gap: SPACING.sm,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: FONT_SIZE.body,
    color: colors.mutedText,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  emptyWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: colors.surface,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  categoryCard: {
    width: "48%",
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.xs,
    backgroundColor: colors.surface,
    padding: SPACING.md,
    gap: SPACING.xs,
    justifyContent: "space-between",
    ...SHADOWS.sm,
  },
  categoryCardPressed: {
    opacity: 0.92,
  },
  categoryName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  categorySlug: {
    color: colors.mutedText,
    fontSize: 12,
  },
  categoryCount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
});