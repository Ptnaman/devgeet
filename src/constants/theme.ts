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
  md: 12,
  lg: 20,
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
    shadowColor: "#0000001A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 8,
  },
  md: {
    shadowColor: "#0000001A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 12,
  },
  lg: {
    shadowColor: "#0000001A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 35,
    elevation: 16,
  },
} as const;
