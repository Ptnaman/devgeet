import { normalizePostContentText } from "@/lib/content";

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const contentContainsHtml = (value: string) =>
  HTML_TAG_PATTERN.test(value.trim());

export const toHtmlContent = (value: string) => {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return "";
  }

  if (contentContainsHtml(normalizedValue)) {
    return normalizedValue;
  }

  return `<p>${escapeHtml(normalizedValue).replace(/\n/g, "<br/>")}</p>`;
};

export const extractPlainTextContent = (value: string) =>
  normalizePostContentText(value).replace(/\u2022 /g, "* ").trim();
