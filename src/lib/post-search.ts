import {
  buildPostSearchIndex,
  normalizeSearchKeyword,
  type PostRecord,
} from "@/lib/content";

export type SearchablePostEntry = {
  post: PostRecord;
  searchIndex: string;
  titleIndex: string;
  authorIndex: string;
  categoryIndex: string;
};

const byRecencyDescending = (left: PostRecord, right: PostRecord) => {
  const leftTimestamp = Date.parse(left.uploadDate || left.createDate || "");
  const rightTimestamp = Date.parse(right.uploadDate || right.createDate || "");

  if (!Number.isNaN(leftTimestamp) || !Number.isNaN(rightTimestamp)) {
    return (Number.isNaN(rightTimestamp) ? 0 : rightTimestamp) -
      (Number.isNaN(leftTimestamp) ? 0 : leftTimestamp);
  }

  return right.title.localeCompare(left.title);
};

const scoreSearchMatch = (
  entry: SearchablePostEntry,
  searchTerm: string,
  searchTokens: string[],
) => {
  if (!searchTerm) {
    return 0;
  }

  let score = 0;

  if (entry.titleIndex === searchTerm) {
    score += 1200;
  } else if (entry.titleIndex.startsWith(searchTerm)) {
    score += 900;
  } else if (entry.titleIndex.includes(searchTerm)) {
    score += 700;
  }

  if (entry.authorIndex === searchTerm) {
    score += 600;
  } else if (entry.authorIndex.startsWith(searchTerm)) {
    score += 450;
  } else if (entry.authorIndex.includes(searchTerm)) {
    score += 300;
  }

  if (entry.categoryIndex === searchTerm) {
    score += 260;
  } else if (entry.categoryIndex.startsWith(searchTerm)) {
    score += 200;
  } else if (entry.categoryIndex.includes(searchTerm)) {
    score += 140;
  }

  if (entry.searchIndex.includes(searchTerm)) {
    score += 100;
  }

  searchTokens.forEach((token) => {
    if (entry.titleIndex.includes(token)) {
      score += 40;
    }
    if (entry.searchIndex.includes(token)) {
      score += 20;
    }
  });

  return score;
};

export const buildSearchablePostEntries = (posts: PostRecord[]) =>
  posts.map((post) => ({
    post,
    searchIndex: buildPostSearchIndex(post),
    titleIndex: normalizeSearchKeyword(post.title),
    authorIndex: normalizeSearchKeyword(
      [post.authorDisplayName, post.authorUsername].filter(Boolean).join(" "),
    ),
    categoryIndex: normalizeSearchKeyword(post.category),
  }));

export const searchPosts = (
  entries: SearchablePostEntry[],
  searchTerm: string,
) => {
  const normalizedSearchTerm = normalizeSearchKeyword(searchTerm);
  if (!normalizedSearchTerm) {
    return entries.map((entry) => entry.post);
  }

  const searchTokens = normalizedSearchTerm.split(" ").filter(Boolean);
  const matchedEntries: { post: PostRecord; score: number }[] = [];

  entries.forEach((entry) => {
    const score = scoreSearchMatch(entry, normalizedSearchTerm, searchTokens);
    if (score > 0) {
      matchedEntries.push({
        post: entry.post,
        score,
      });
    }
  });

  matchedEntries.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return byRecencyDescending(left.post, right.post);
  });

  return matchedEntries.map((entry) => entry.post);
};

export const getSuggestedSearchTerms = (
  posts: PostRecord[],
  limit = 3,
) => {
  const uniqueTitles: string[] = [];
  const seenTitles = new Set<string>();

  [...posts]
    .sort(byRecencyDescending)
    .forEach((post) => {
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

  return uniqueTitles.slice(0, limit);
};

export const sanitizeRecentSearches = (
  values: string[],
  limit: number,
) => {
  const uniqueValues: string[] = [];
  const seenValues = new Set<string>();

  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      const normalizedValue = value.toLowerCase();
      if (seenValues.has(normalizedValue)) {
        return;
      }

      seenValues.add(normalizedValue);
      uniqueValues.push(value);
    });

  return uniqueValues.slice(0, limit);
};

export const upsertRecentSearch = (
  currentValues: string[],
  nextValue: string,
  limit: number,
) => {
  const normalizedValue = nextValue.trim();
  if (!normalizedValue) {
    return currentValues;
  }

  return sanitizeRecentSearches(
    [
      normalizedValue,
      ...currentValues.filter(
        (value) => value.trim().toLowerCase() !== normalizedValue.toLowerCase(),
      ),
    ],
    limit,
  );
};

export const removeRecentSearch = (
  currentValues: string[],
  valueToRemove: string,
) => {
  const normalizedValueToRemove = valueToRemove.trim().toLowerCase();
  if (!normalizedValueToRemove) {
    return currentValues;
  }

  return currentValues.filter(
    (value) => value.trim().toLowerCase() !== normalizedValueToRemove,
  );
};
