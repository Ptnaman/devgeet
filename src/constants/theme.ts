const withOpacity = (hex: string, opacity: number) => {
  const boundedOpacity = Math.max(0, Math.min(opacity, 1));
  const alpha = Math.round(boundedOpacity * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

  return `${hex}${alpha}`;
};

const LIGHT_TEXT = "#111827";
const DARK_TEXT = "#FFFDFC";

export const LIGHT_COLORS = {
  background: "#EEF0F3",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  surfaceSoft: "#F5F7FA",
  activeSurface: "#EFF6FF",
  text: LIGHT_TEXT,
  mutedText: withOpacity(LIGHT_TEXT, 0.8),
  subtleText: withOpacity(LIGHT_TEXT, 0.7),
  border: "#ECEFF3",
  divider: "#EEF2F6",
  primary: "#111827",
  primaryText: "#FFFFFF",
  accent: "#1D4ED8",
  accentSoft: "#EFF6FF",
  accentBorder: "#D8E7FF",
  success: "#166534",
  successSoft: "#ECFDF3",
  danger: "#C62828",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#F6C9CF",
  tabActive: withOpacity(LIGHT_TEXT, 0.9),
  tabInactive: withOpacity(LIGHT_TEXT, 0.68),
} as const;

export const DARK_COLORS = {
  background: "#1E1E1E",
  surface: "#2D2D30",
  surfaceMuted: "#fffdfd1a",
  surfaceSoft: "#1E293B",
  activeSurface: "#0000001A",
  text: DARK_TEXT,
  mutedText: withOpacity(DARK_TEXT, 0.8),
  subtleText: withOpacity(DARK_TEXT, 0.7),
  border: "transparent",
  divider: "#FFFFFF1A",
  primary: "#E2E8F0",
  primaryText: "#0F172A",
  accent: "#60A5FA",
  accentSoft: "#0F1E35",
  accentBorder: "#1D4ED8",
  success: "#22C55E",
  successSoft: "#052E1A",
  danger: "#F87171",
  dangerSoft: "#341316",
  dangerBorder: "#7F1D1D",
  tabActive: withOpacity(DARK_TEXT, 0.9),
  tabInactive: withOpacity(DARK_TEXT, 0.72),
} as const;

export const COLORS = LIGHT_COLORS;

export const THEME_COLORS = {
  light: LIGHT_COLORS,
  dark: DARK_COLORS,
} as const;

export type ThemeMode = keyof typeof THEME_COLORS;
export type ThemeColors = Record<keyof typeof LIGHT_COLORS, string>;

export const getThemeColors = (mode: ThemeMode | null | undefined) =>
  mode === "dark" ? DARK_COLORS : LIGHT_COLORS;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const RADIUS = {
  xs: 8,
  sm: 12,
  inputSm: 5,
  md: 18,
  lg: 26,
  xl: 30,
  input: 18,
  card: 16,
  pill: 999,
};

export const FONT_SIZE = {
  body: 14,
  button: 16,
  subtitle: 14,
  title: 26,
  heroTitle: 30,
};

export const CONTROL_SIZE = {
  inputHeight: 56,
};

export const SHADOWS = {
  sm: {
    shadowColor: "#0000001b",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  md: {
    shadowColor: "#0000003b",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  lg: {
    shadowColor: "#0000005b",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
} as const;
