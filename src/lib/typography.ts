import { StyleSheet, Text, TextInput, type StyleProp, type TextStyle } from "react-native";

export const APP_FONTS = {
  regular: "GoogleSans-Regular",
  medium: "GoogleSans-Medium",
  bold: "GoogleSans-Bold",
  italic: "GoogleSans-Italic",
  mediumItalic: "GoogleSans-MediumItalic",
  boldItalic: "GoogleSans-BoldItalic",
} as const;

const TEXT_STYLE_KEYS: readonly (keyof TextStyle)[] = [
  "color",
  "fontSize",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "includeFontPadding",
  "letterSpacing",
  "lineHeight",
  "textAlign",
  "textDecorationLine",
  "textTransform",
];
const TEXT_STYLE_NAME_PATTERN =
  /(text|title|label|heading|subtitle|caption|copy|body|input|placeholder|helper|error|cta)/i;

let hasInstalledTypography = false;

const parseFontWeight = (value: TextStyle["fontWeight"]) => {
  if (typeof value === "number") {
    return value;
  }

  if (value === "normal" || !value) {
    return 400;
  }

  if (value === "bold") {
    return 700;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 400 : parsed;
};

const resolveFontFamily = (style: TextStyle) => {
  const weight = parseFontWeight(style.fontWeight);
  const isItalic = style.fontStyle === "italic";

  if (weight >= 700) {
    return isItalic ? APP_FONTS.boldItalic : APP_FONTS.bold;
  }

  if (weight >= 500) {
    return isItalic ? APP_FONTS.mediumItalic : APP_FONTS.medium;
  }

  return isItalic ? APP_FONTS.italic : APP_FONTS.regular;
};

const shouldApplyFontFamily = (styleName: string, style: TextStyle) =>
  !style.fontFamily &&
  (TEXT_STYLE_KEYS.some((key) => key in style) || TEXT_STYLE_NAME_PATTERN.test(styleName));

const patchNamedStyles = <T extends Record<string, TextStyle | object>>(styles: T): T => {
  const patchedEntries = Object.entries(styles).map(([styleName, styleValue]) => {
    if (!styleValue || typeof styleValue !== "object" || Array.isArray(styleValue)) {
      return [styleName, styleValue];
    }

    const textStyle = styleValue as TextStyle;
    if (!shouldApplyFontFamily(styleName, textStyle)) {
      return [styleName, styleValue];
    }

    return [
      styleName,
      {
        ...styleValue,
        fontFamily: resolveFontFamily(textStyle),
      },
    ];
  });

  return Object.fromEntries(patchedEntries) as T;
};

const installDefaultProps = () => {
  const textComponent = Text as typeof Text & {
    defaultProps?: { style?: StyleProp<TextStyle> };
  };
  const textInputComponent = TextInput as typeof TextInput & {
    defaultProps?: { style?: StyleProp<TextStyle> };
  };

  textComponent.defaultProps = {
    ...textComponent.defaultProps,
    style: [{ fontFamily: APP_FONTS.regular }, textComponent.defaultProps?.style].filter(Boolean),
  };

  textInputComponent.defaultProps = {
    ...textInputComponent.defaultProps,
    style: [{ fontFamily: APP_FONTS.regular }, textInputComponent.defaultProps?.style].filter(
      Boolean
    ),
  };
};

export const installGlobalTypography = () => {
  if (hasInstalledTypography) {
    return;
  }

  hasInstalledTypography = true;

  const originalCreate = StyleSheet.create.bind(StyleSheet);
  const stylesheet = StyleSheet as typeof StyleSheet & {
    create: typeof StyleSheet.create;
  };

  stylesheet.create = ((styles: Parameters<typeof StyleSheet.create>[0]) =>
    originalCreate(patchNamedStyles(styles as Record<string, TextStyle | object>))) as typeof StyleSheet.create;

  installDefaultProps();
};
