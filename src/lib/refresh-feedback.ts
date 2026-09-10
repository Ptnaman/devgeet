const DEFAULT_MINIMUM_REFRESH_DURATION_MS = 650;

const waitAsync = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });

const isSameCalendarDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const withMinimumRefreshDurationAsync = async <T,>(
  task: () => Promise<T>,
  minimumDurationMs = DEFAULT_MINIMUM_REFRESH_DURATION_MS,
) => {
  const startedAt = Date.now();

  try {
    return await task();
  } finally {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs < minimumDurationMs) {
      await waitAsync(minimumDurationMs - elapsedMs);
    }
  }
};

export const formatLastUpdatedLabel = (timestamp: number | null) => {
  if (!timestamp) {
    return "";
  }

  const updatedAt = new Date(timestamp);
  if (Number.isNaN(updatedAt.getTime())) {
    return "";
  }

  const now = new Date();
  if (now.getTime() - updatedAt.getTime() < 60_000) {
    return "Last updated just now";
  }

  const timeLabel = updatedAt.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isSameCalendarDay(updatedAt, now)) {
    return `Last updated ${timeLabel}`;
  }

  const dateLabel = updatedAt.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });

  return `Last updated ${dateLabel}, ${timeLabel}`;
};
