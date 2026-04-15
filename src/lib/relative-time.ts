export const formatRelativeTime = (value: string) => {
  if (!value) {
    return "";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const diffMs = Date.now() - timestamp;
  const normalizedDiffMs = Math.max(diffMs, 0);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  if (normalizedDiffMs < minuteMs) {
    return "Just now";
  }

  if (normalizedDiffMs < hourMs) {
    const minutes = Math.floor(normalizedDiffMs / minuteMs);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  if (normalizedDiffMs < dayMs) {
    const hours = Math.floor(normalizedDiffMs / hourMs);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  if (normalizedDiffMs < weekMs) {
    const days = Math.floor(normalizedDiffMs / dayMs);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  if (normalizedDiffMs < monthMs) {
    const weeks = Math.floor(normalizedDiffMs / weekMs);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  if (normalizedDiffMs < yearMs) {
    const months = Math.floor(normalizedDiffMs / monthMs);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }

  const years = Math.floor(normalizedDiffMs / yearMs);
  return `${years} year${years === 1 ? "" : "s"} ago`;
};
