import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { SearchInputIcon } from "@/components/icons/search-input-icon";
import { MainTabScrollView } from "@/components/main-tabs/main-tab-scroll-view";
import { SkeletonBlock } from "@/components/skeleton-block";
import {
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import {
  getContentPreviewLines,
  getPostCardThumbnailUrl,
} from "@/lib/content";
import { useMainTabData } from "@/providers/main-tab-data-provider";
import { useAppTheme } from "@/providers/theme-provider";

const HOME_SKELETON_ITEMS = Array.from({ length: 3 }, (_, index) => index);

export function HomeTabContent() {
  const { colors, resolvedTheme } = useAppTheme();
  const { publishedPosts, isLoadingPosts, postsError } = useMainTabData();
  const router = useRouter();
  const styles = createStyles(colors, resolvedTheme);
  const showInlineError = Boolean(postsError);

  const openSearchScreen = () => {
    router.push("/search");
  };

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  };

  return (
    <View style={styles.screen}>
      <MainTabScrollView
        tabName="home"
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [
            styles.searchLauncher,
            pressed ? styles.searchLauncherPressed : null,
          ]}
          onPress={openSearchScreen}
          accessibilityRole="button"
          accessibilityLabel="Open search"
        >
          <SearchInputIcon color={colors.mutedText} size={18} />
          <Text style={styles.searchLauncherText}>Search lyrics</Text>
        </Pressable>

        {isLoadingPosts
          ? HOME_SKELETON_ITEMS.map((item) => (
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

        {!isLoadingPosts && !showInlineError && !publishedPosts.length ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No published posts are available right now.</Text>
          </View>
        ) : null}

        {!isLoadingPosts
          ? publishedPosts.map((post) => {
            const thumbnailUrl = getPostCardThumbnailUrl(post);
            const previewText = getContentPreviewLines(post.content);
            const authorName =
              post.authorDisplayName.trim() ||
              post.authorUsername.trim() ||
              "Unknown Author";

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
                  <Text style={styles.cardAuthor} numberOfLines={1}>
                    {`By ${authorName}`}
                  </Text>
                </Pressable>
              </View>
            );
          })
          : null}
      </MainTabScrollView>
    </View>
  );
}

const createStyles = (
  colors: ThemeColors,
  resolvedTheme: "light" | "dark",
) => {
  const isDarkTheme = resolvedTheme === "dark";
  const launcherBorderColor = isDarkTheme ? colors.inputBorderHover : colors.border;
  const launcherBackgroundColor = isDarkTheme ? colors.surface : "#FFFFFF";

  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    container: {
      flexGrow: 1,
      padding: SPACING.xxl,
      gap: SPACING.xl,
      backgroundColor: colors.background,
    },
    searchLauncher: {
      minHeight: 56,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: launcherBorderColor,
      backgroundColor: launcherBackgroundColor,
      paddingHorizontal: SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      ...SHADOWS.sm,
    },
    searchLauncherPressed: {
      opacity: 0.86,
    },
    searchLauncherText: {
      color: colors.placeholderText,
      fontSize: 15,
    },
    card: {
      borderRadius: 14,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      gap: SPACING.sm,
      ...SHADOWS.sm,
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
      borderRadius: 9,
      backgroundColor: colors.surfaceSoft,
    },
    thumbnailFallback: {
      width: "100%",
      height: 156,
      borderRadius: 9,
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
    cardAuthor: {
      fontSize: 12,
      color: colors.subtleText,
      fontWeight: "600",
      lineHeight: 18,
    },
    cardFooter: {
      marginTop: SPACING.xs,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.sm,
    },
    errorText: {
      color: colors.danger,
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
  });
};
