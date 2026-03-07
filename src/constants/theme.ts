export const COLORS = {
  background: "#F3F6FB",
  surface: "#FFFFFF",
  text: "#0F172A",
  mutedText: "#64748B",
  border: "#D8E0EA",
  primary: "#0F172A",
  primaryText: "#FFFFFF",
  danger: "#B91C1C",
  tabActive: "#0F172A",
  tabInactive: "#6B7280",
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
  sm: 10,
  inputSm: 5,
  md: 12,
  lg: 20,
  xl: 26,
  input: 14,
  card: 24,
  pill: 999,
};

export const FONT_SIZE = {
  body: 14,
  button: 16,
  subtitle: 14,
  title: 24,
  heroTitle: 28,
};

export const CONTROL_SIZE = {
  inputHeight: 52,
};

export const SHADOWS = {
  sm: {
    shadowColor: "#0000001a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  md: {
    shadowColor: "#0000003a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  lg: {
    shadowColor: "#0000005a",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 36,
    elevation: 14,
  },
} as const;
