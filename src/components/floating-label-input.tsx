import {
  type ForwardedRef,
  type ReactNode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Pressable,
  type StyleProp,
  StyleSheet,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";

import { CONTROL_SIZE, FONT_SIZE, SPACING, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

type FloatingLabelInputProps = Omit<TextInputProps, "placeholder"> & {
  label: string;
  backgroundColor?: string;
  inactiveLabelColor?: string;
  activeLabelColor?: string;
  borderColor?: string;
  hoverBorderColor?: string;
  activeBorderColor?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  leadingAccessory?: ReactNode;
  trailingAccessory?: ReactNode;
};

const LABEL_ANIMATION_DURATION = 190;
const FOCUS_ANIMATION_DURATION = 160;
const LABEL_FLOAT_DISTANCE = 29;
const LABEL_ACTIVE_SCALE = 0.84;

const resolveFloatingLabelBackground = (color: string) => {
  const normalizedColor = color.trim();

  if (/^#[0-9A-Fa-f]{6}$/.test(normalizedColor)) {
    return `${normalizedColor}F4`;
  }

  if (/^#[0-9A-Fa-f]{3}$/.test(normalizedColor)) {
    const [r, g, b] = normalizedColor.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}F4`;
  }

  if (/^#[0-9A-Fa-f]{8}$/.test(normalizedColor)) {
    return `${normalizedColor.slice(0, 7)}F4`;
  }

  return color;
};

function FloatingLabelInputInner(
  {
    label,
    value,
    defaultValue,
    editable = true,
    multiline = false,
    onChangeText,
    onFocus,
    onBlur,
    selectionColor,
    cursorColor,
    backgroundColor,
    inactiveLabelColor,
    activeLabelColor,
    borderColor,
    hoverBorderColor,
    activeBorderColor,
    containerStyle,
    inputStyle,
    leadingAccessory,
    trailingAccessory,
    ...textInputProps
  }: FloatingLabelInputProps,
  forwardedRef: ForwardedRef<TextInput>
) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [internalValue, setInternalValue] = useState(
    typeof value === "string" ? value : typeof defaultValue === "string" ? defaultValue : ""
  );
  const isEditable = editable !== false;
  const resolvedValue = typeof value === "string" ? value : internalValue;
  const hasValue = resolvedValue.trim().length > 0;
  const isActive = isFocused || hasValue;
  const resolvedBackgroundColor = backgroundColor ?? colors.surface;
  const resolvedInactiveLabelColor = inactiveLabelColor ?? colors.inputLabel;
  const resolvedActiveLabelColor = activeLabelColor ?? colors.inputLabelActive;
  const resolvedInputBorderColor = borderColor ?? colors.inputBorder;
  const resolvedHoverBorderColor = hoverBorderColor ?? colors.inputBorderHover;
  const resolvedActiveBorderColor = activeBorderColor ?? colors.inputFocus;
  const labelAnimation = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const focusAnimation = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const labelBackgroundColor = resolveFloatingLabelBackground(resolvedBackgroundColor);
  const resolvedBorderColor = !isEditable
    ? resolvedInputBorderColor
    : isFocused
      ? resolvedActiveBorderColor
      : isHovered
        ? resolvedHoverBorderColor
        : resolvedInputBorderColor;

  useImperativeHandle(forwardedRef, () => inputRef.current as TextInput);

  useEffect(() => {
    if (typeof value === "string") {
      setInternalValue(value);
    }
  }, [value]);

  useEffect(() => {
    Animated.timing(labelAnimation, {
      toValue: isActive ? 1 : 0,
      duration: LABEL_ANIMATION_DURATION,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [isActive, labelAnimation]);

  useEffect(() => {
    Animated.timing(focusAnimation, {
      toValue: isFocused ? 1 : 0,
      duration: FOCUS_ANIMATION_DURATION,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [focusAnimation, isFocused]);

  return (
    <Pressable
      style={[
        styles.container,
        multiline && styles.containerMultiline,
        !isEditable && styles.containerDisabled,
        { backgroundColor: resolvedBackgroundColor, borderColor: resolvedBorderColor },
        containerStyle,
      ]}
      onPress={() => {
        if (isEditable) {
          inputRef.current?.focus();
        }
      }}
      onHoverIn={() => {
        if (isEditable) {
          setIsHovered(true);
        }
      }}
      onHoverOut={() => setIsHovered(false)}
      disabled={!isEditable}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.focusRing,
          {
            borderColor: resolvedActiveBorderColor,
            opacity: focusAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.18],
            }),
            transform: [
              {
                scale: focusAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.99, 1],
                }),
              },
            ],
          },
        ]}
      />

      <View
        pointerEvents="box-none"
        style={[
          styles.labelSlot,
          multiline && styles.labelSlotMultiline,
          leadingAccessory ? styles.labelSlotWithLeadingAccessory : undefined,
          trailingAccessory ? styles.labelSlotWithAccessory : undefined,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.labelChip,
            {
              backgroundColor: labelBackgroundColor,
              transform: [
                {
                  translateY: labelAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -LABEL_FLOAT_DISTANCE],
                  }),
                },
                {
                  translateX: labelAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -2],
                  }),
                },
                {
                  scale: labelAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, LABEL_ACTIVE_SCALE],
                  }),
                },
              ],
            },
          ]}
        >
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                color: resolvedInactiveLabelColor,
                opacity: labelAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
              },
            ]}
          >
            {label}
          </Animated.Text>
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.label,
              styles.labelOverlay,
              {
                color: resolvedActiveLabelColor,
                opacity: labelAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ]}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </View>

      <View style={[styles.inputRow, multiline && styles.inputRowMultiline]}>
        {leadingAccessory ? <View style={styles.leadingAccessory}>{leadingAccessory}</View> : null}
        <TextInput
          {...textInputProps}
          ref={inputRef}
          value={resolvedValue}
          editable={editable}
          multiline={multiline}
          placeholder=""
          selectionColor={selectionColor ?? resolvedActiveBorderColor}
          cursorColor={cursorColor ?? resolvedActiveBorderColor}
          onChangeText={(nextValue) => {
            if (typeof value !== "string") {
              setInternalValue(nextValue);
            }
            onChangeText?.(nextValue);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
        />
        {trailingAccessory ? <View style={styles.trailingAccessory}>{trailingAccessory}</View> : null}
      </View>
    </Pressable>
  );
}

export const FloatingLabelInput = forwardRef(FloatingLabelInputInner);
FloatingLabelInput.displayName = "FloatingLabelInput";

const createStyles = (colors: ThemeColors) => {
  return StyleSheet.create({
    container: {
      minHeight: CONTROL_SIZE.inputHeight + 2,
      borderRadius: 18,
      borderWidth: 1,
      paddingHorizontal: SPACING.lg,
      justifyContent: "center",
      position: "relative",
      overflow: "visible",
    },
    containerMultiline: {
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.xs,
    },
    containerDisabled: {
      opacity: 0.68,
    },
    focusRing: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 18,
      borderWidth: 2,
    },
    labelSlot: {
      position: "absolute",
      left: SPACING.lg - 4,
      top: 0,
      bottom: 0,
      right: SPACING.lg,
      justifyContent: "center",
      zIndex: 2,
    },
    labelSlotMultiline: {
      top: 22,
      bottom: undefined,
      justifyContent: "flex-start",
    },
    labelSlotWithAccessory: {
      right: SPACING.xl + 36,
    },
    labelSlotWithLeadingAccessory: {
      left: SPACING.lg + 26,
    },
    labelChip: {
      alignSelf: "flex-start",
      minHeight: 20,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      justifyContent: "center",
    },
    label: {
      fontSize: FONT_SIZE.body + 1,
      lineHeight: 18,
      fontWeight: "600",
      letterSpacing: 0.1,
    },
    labelOverlay: {
      position: "absolute",
      left: 6,
      top: 0,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: CONTROL_SIZE.inputHeight + 2,
    },
    inputRowMultiline: {
      alignItems: "flex-start",
      minHeight: 140,
    },
    input: {
      height: CONTROL_SIZE.inputHeight + 2,
      flex: 1,
      paddingTop: 0,
      paddingBottom: 0,
      paddingHorizontal: 0,
      color: colors.text,
      fontSize: FONT_SIZE.button,
      lineHeight: 20,
      textAlignVertical: "center",
    },
    inputMultiline: {
      minHeight: 140,
      height: undefined,
      paddingTop: 30,
      paddingBottom: SPACING.md,
      textAlignVertical: "top",
    },
    trailingAccessory: {
      marginLeft: SPACING.sm,
      alignSelf: "center",
    },
    leadingAccessory: {
      marginRight: SPACING.sm + 2,
      alignSelf: "center",
    },
  });
};
