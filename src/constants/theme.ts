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
const LIGHT_ICON_MUTED = "#6B7280";

export const STATIC_COLORS = {
  black: "#000000",
  white: "#FFFFFF",
  offWhite: DARK_TEXT,
  toastText: "#F5F5F5",
  favoriteRemove: "#F56B98",
  googleBlue: "#4285F4",
  googleGreen: "#34A853",
  googleRed: "#EA4335",
  googleYellow: "#FBBC05",
  iconMuted: LIGHT_ICON_MUTED,
} as const;

export const BRAND_COLORS = {
  google: {
    red: STATIC_COLORS.googleRed,
    blue: STATIC_COLORS.googleBlue,
    yellow: STATIC_COLORS.googleYellow,
    green: STATIC_COLORS.googleGreen,
  },
} as const;

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceSoft: string;
  activeSurface: string;
  overlay: string;
  backdropOverlay: string;
  backdropGlassTint: string;
  toastBackground: string;
  toastText: string;
  mediaSurface: string;
  text: string;
  subtitleText: string;
  mutedText: string;
  subtleText: string;
  placeholderText: string;
  border: string;
  divider: string;
  primary: string;
  primaryText: string;
  primaryMutedText: string;
  brandPrimary: string;
  brandPrimaryDisabled: string;
  brandPrimaryText: string;
  brandAccent: string;
  brandAccentBorder: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  success: string;
  successSoft: string;
  successBorder: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  inputLabel: string;
  inputLabelActive: string;
  inputBorder: string;
  inputBorderHover: string;
  inputFocus: string;
  iconMuted: string;
  favoriteSurface: string;
  favoriteIcon: string;
  favoriteAccent: string;
  favoriteAccentUnderlay: string;
  favoriteRemove: string;
  tabActive: string;
  tabInactive: string;
};

type ThemeCssColorKey = {
  [K in keyof ThemeColors]: ThemeColors[K] extends string ? K : never;
}[keyof ThemeColors];

export type WebThemeCssColorKey = ThemeCssColorKey;

export const LIGHT_COLORS: ThemeColors = {
  background: "#f4f4f4",
  surface: "#fff",
  surfaceMuted: "#F8FAFC",
  surfaceSoft: "#F5F7FA",
  activeSurface: "#EFF6FF",
  overlay: "#00000055",
  backdropOverlay: withOpacity(LIGHT_TEXT, 0.12),
  backdropGlassTint: withOpacity(STATIC_COLORS.white, 0.08),
  toastBackground: withOpacity("#2D2D30", 0.82),
  toastText: STATIC_COLORS.toastText,
  mediaSurface: STATIC_COLORS.black,
  text: LIGHT_TEXT,
  subtitleText: "#777777",
  mutedText: withOpacity(LIGHT_TEXT, 0.8),
  subtleText: withOpacity(LIGHT_TEXT, 0.7),
  placeholderText: "#6E6E6E",
  border: "#ECEFF3",
  divider: "#EEF2F6",
  primary: LIGHT_TEXT,
  primaryText: STATIC_COLORS.white,
  primaryMutedText: "#DBEAFE",
  brandPrimary: "#1E3A8A",
  brandPrimaryDisabled: "#94A3B8",
  brandPrimaryText: STATIC_COLORS.white,
  brandAccent: "#F97316",
  brandAccentBorder: "#FED7AA",
  accent: "#1D4ED8",
  accentSoft: "#EFF6FF",
  accentBorder: "#D8E7FF",
  success: "#166534",
  successSoft: "#F0FDF4",
  successBorder: "#BBF7D0",
  warning: "#92400E",
  warningSoft: "#FFFBEB",
  warningBorder: "#D97706",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
  inputLabel: "#8A8A8A",
  inputLabelActive: LIGHT_ICON_MUTED,
  inputBorder: "#F2F0EE",
  inputBorderHover: "#CBD5E1",
  inputFocus: LIGHT_TEXT,
  iconMuted: LIGHT_ICON_MUTED,
  favoriteSurface: STATIC_COLORS.white,
  favoriteIcon: LIGHT_TEXT,
  favoriteAccent: LIGHT_TEXT,
  favoriteAccentUnderlay: STATIC_COLORS.white,
  favoriteRemove: STATIC_COLORS.favoriteRemove,
  tabActive: withOpacity(LIGHT_TEXT, 0.9),
  tabInactive: withOpacity(LIGHT_TEXT, 0.68),
};

export const DARK_COLORS: ThemeColors = {
  background: "#1E1E1E",
  surface: "#2D2D30",
  surfaceMuted: "#3f3f3f",
  surfaceSoft: "#1E293B",
  activeSurface: "#0000001A",
  overlay: "#00000055",
  backdropOverlay: withOpacity(STATIC_COLORS.black, 0.28),
  backdropGlassTint: withOpacity(STATIC_COLORS.white, 0.08),
  toastBackground: withOpacity("#2D2D30", 0.82),
  toastText: STATIC_COLORS.toastText,
  mediaSurface: STATIC_COLORS.black,
  text: DARK_TEXT,
  subtitleText: withOpacity(DARK_TEXT, 0.72),
  mutedText: withOpacity(DARK_TEXT, 0.8),
  subtleText: withOpacity(DARK_TEXT, 0.72),
  placeholderText: withOpacity(DARK_TEXT, 0.55),
  border: "transparent",
  divider: "#FFFFFF1A",
  primary: "#E2E8F0",
  primaryText: "#0F172A",
  primaryMutedText: withOpacity("#0F172A", 0.7),
  brandPrimary: "#60A5FA",
  brandPrimaryDisabled: withOpacity("#60A5FA", 0.45),
  brandPrimaryText: STATIC_COLORS.white,
  brandAccent: "#FB923C",
  brandAccentBorder: withOpacity("#FB923C", 0.45),
  accent: "#60A5FA",
  accentSoft: "#0F1E35",
  accentBorder: "#1D4ED8",
  success: "#22C55E",
  successSoft: "#052E1A",
  successBorder: "#166534",
  warning: "#FBBF24",
  warningSoft: "#3F2A0E",
  warningBorder: "#92400E",
  danger: "#F87171",
  dangerSoft: "#341316",
  dangerBorder: "#7F1D1D",
  inputLabel: withOpacity(DARK_TEXT, 0.55),
  inputLabelActive: withOpacity(DARK_TEXT, 0.72),
  inputBorder: withOpacity(DARK_TEXT, 0.14),
  inputBorderHover: withOpacity(DARK_TEXT, 0.24),
  inputFocus: DARK_TEXT,
  iconMuted: withOpacity(DARK_TEXT, 0.72),
  favoriteSurface: "#2D2D30",
  favoriteIcon: STATIC_COLORS.white,
  favoriteAccent: LIGHT_TEXT,
  favoriteAccentUnderlay: STATIC_COLORS.white,
  favoriteRemove: STATIC_COLORS.favoriteRemove,
  tabActive: withOpacity(DARK_TEXT, 0.9),
  tabInactive: withOpacity(DARK_TEXT, 0.72),
};

export const COLORS = LIGHT_COLORS;

export const THEME_COLORS = {
  light: LIGHT_COLORS,
  dark: DARK_COLORS,
} as const satisfies Record<string, ThemeColors>;

export type ThemeMode = keyof typeof THEME_COLORS;

export type FavoriteActionPalette = {
  color: string;
  fillColor: string;
  accentColor: string;
  accentUnderlayColor?: string;
  surfaceColor: string;
};

export const WEB_THEME_CSS_VARIABLES = {
  "--color-bg": "background",
  "--color-surface": "surface",
  "--color-text": "text",
  "--color-muted": "mutedText",
  "--color-border": "border",
  "--color-primary": "primary",
  "--color-primary-text": "primaryText",
} as const satisfies Record<string, ThemeCssColorKey>;

export const getThemeColors = (mode: ThemeMode | null | undefined): ThemeColors =>
  mode === "dark" ? DARK_COLORS : LIGHT_COLORS;

export const getFavoriteActionPalette = (
  mode: ThemeMode | null | undefined,
): FavoriteActionPalette => {
  const colors = getThemeColors(mode);
  const isDarkTheme = mode === "dark";

  return {
    color: colors.favoriteIcon,
    fillColor: colors.favoriteIcon,
    accentColor: colors.favoriteAccent,
    accentUnderlayColor: isDarkTheme ? undefined : colors.favoriteAccentUnderlay,
    surfaceColor: colors.favoriteSurface,
  };
};

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
    shadowColor: "#0000002f",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 20,
  },
  md: {
    shadowColor: "#0000004f",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 25,
  },
  lg: {
    shadowColor: "#0000006f",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 30,
    elevation: 35,
  },
} as const;
