import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";

import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import { formatDate, mapPostRecord, POSTS_COLLECTION, type PostRecord } from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";

export default function HomeScreen() {
  const { user, isAdmin } = useAuth();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const accountSubtitle = isAdmin
    ? `Admin logged in: ${user?.email || "Admin"}`
    : `User logged in: ${user?.displayName || user?.email || "User"}`;

  useEffect(() => {
    const postsQuery = query(
      collection(firestore, POSTS_COLLECTION),
      orderBy("createDate", "desc")
    );

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const nextPosts = snapshot.docs
          .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
          .filter((post) => post.status === "published");

        setError("");
        setPosts(nextPosts);
        setIsLoading(false);
      },
      () => {
        setError("Unable to load posts right now.");
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const subtitle = useMemo(() => {
    if (isLoading) {
      return "Loading posts...";
    }

    if (error) {
      return error;
    }

    if (!posts.length) {
      return "No published posts yet.";
    }

    return `${posts.length} post${posts.length === 1 ? "" : "s"} published.`;
  }, [error, isLoading, posts.length]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>DevGeet Posts</Text>
      <Text style={styles.subtitle}>{accountSubtitle}</Text>
      <View
        style={[
          styles.roleBanner,
          isAdmin ? styles.roleBannerAdmin : styles.roleBannerUser,
        ]}
      >
        <Text style={styles.roleBannerTitle}>
          {isAdmin ? "Admin Interface" : "User Interface"}
        </Text>
        <Text style={styles.roleBannerText}>
          {isAdmin
            ? "Open Admin Panel from the drawer menu in header."
            : "You are in standard user mode with normal app features."}
        </Text>
      </View>
      <Text style={styles.feedText}>{subtitle}</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : null}

      {posts.map((post) => (
        <View key={post.id} style={styles.card}>
          <Text style={styles.cardTitle}>{post.title}</Text>
          <Text style={styles.cardContent}>{post.content}</Text>
          <Text style={styles.meta}>Category: {post.category}</Text>
          <Text style={styles.meta}>Create Date: {formatDate(post.createDate)}</Text>
          <Text style={styles.meta}>ID: {post.id}</Text>
          <Text style={styles.meta}>Slug: {post.slug || "-"}</Text>
          <Text style={styles.meta}>Status: {post.status}</Text>
          <Text style={styles.meta}>Upload Date: {formatDate(post.uploadDate)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: SPACING.xxl,
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZE.body,
    color: COLORS.mutedText,
  },
  feedText: {
    fontSize: FONT_SIZE.body,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  roleBanner: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  roleBannerUser: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  roleBannerAdmin: {
    backgroundColor: "#ECFDF5",
    borderColor: "#6EE7B7",
  },
  roleBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  roleBannerText: {
    fontSize: 13,
    color: COLORS.mutedText,
  },
  loader: {
    marginVertical: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  cardContent: {
    fontSize: FONT_SIZE.body,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  meta: {
    fontSize: 12,
    color: COLORS.mutedText,
  },
});
