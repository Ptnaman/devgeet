export const COLORS = {
  background: "#EEF0F3",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  surfaceSoft: "#F5F7FA",
  text: "#111827",
  mutedText: "#7B8494",
  subtleText: "#9AA1AD",
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
  tabActive: "#111827",
  tabInactive: "#9AA1AD",
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
