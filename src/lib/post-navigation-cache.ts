import type { PostRecord } from "@/lib/content";

const MAX_CACHED_POSTS = 120;
const postNavigationCache = new Map<string, PostRecord>();

export const primePostNavigationCache = (post: PostRecord) => {
  if (!post.id) {
    return;
  }

  if (postNavigationCache.has(post.id)) {
    postNavigationCache.delete(post.id);
  }

  postNavigationCache.set(post.id, post);

  if (postNavigationCache.size <= MAX_CACHED_POSTS) {
    return;
  }

  const oldestPostId = postNavigationCache.keys().next().value;
  if (typeof oldestPostId === "string") {
    postNavigationCache.delete(oldestPostId);
  }
};

export const readPostNavigationCache = (postId: string) =>
  postId ? postNavigationCache.get(postId) ?? null : null;
