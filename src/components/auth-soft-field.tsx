import { type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  type TextInputProps,
  type TextStyle,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";

import { FloatingLabelInput } from "@/components/floating-label-input";
import { FONT_SIZE, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

type AuthSoftFieldTone = "default" | "success" | "error";
type AuthSoftSupportTone = "default" | "success" | "error";

type AuthSoftInputProps = Omit<TextInputProps, "style" | "placeholder"> & {
  label: string;
  tone?: AuthSoftFieldTone;
  containerStyle?: StyleProp<ViewStyle>;
  shellStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  leadingAccessory?: ReactNode;
  trailingAccessory?: ReactNode;
  errorMessage?: string;
  supportingText?: string;
  supportingTone?: AuthSoftSupportTone;
};

export function AuthSoftInput({
  label,
  tone = "default",
  containerStyle,
  shellStyle,
  inputStyle,
  leadingAccessory,
  trailingAccessory,
  errorMessage,
  supportingText,
  supportingTone = "default",
  editable = true,
  multiline = false,
  placeholderTextColor: _placeholderTextColor,
  ...textInputProps
}: AuthSoftInputProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const resolvedBorderColor =
    tone === "success"
      ? colors.successBorder
      : tone === "error"
        ? colors.dangerBorder
        : colors.inputBorder;

  const resolvedActiveBorderColor =
    tone === "success"
      ? colors.success
      : tone === "error"
        ? colors.danger
        : colors.inputFocus;

  const resolvedHoverBorderColor =
    tone === "default"
      ? "#000000"
      : tone === "success"
        ? colors.successBorder
        : colors.dangerBorder;

  return (
    <StyleGroup containerStyle={containerStyle}>
      <FloatingLabelInput
        {...textInputProps}
        editable={editable}
        multiline={multiline}
        label={label}
        backgroundColor={colors.surface}
        inactiveLabelColor={colors.inputLabel}
        activeLabelColor={colors.inputLabelActive}
        borderColor={resolvedBorderColor}
        hoverBorderColor={resolvedHoverBorderColor}
        activeBorderColor={resolvedActiveBorderColor}
        leadingAccessory={leadingAccessory}
        trailingAccessory={trailingAccessory}
        containerStyle={[
          styles.container,
          tone === "success" ? styles.containerSuccess : undefined,
          tone === "error" ? styles.containerError : undefined,
          shellStyle,
        ]}
        inputStyle={[
          styles.input,
          multiline ? styles.inputMultiline : undefined,
          inputStyle,
        ]}
      />
      {errorMessage ? (
        <Text style={[styles.supportingText, styles.supportingTextError]}>{errorMessage}</Text>
      ) : supportingText ? (
        <Text
          style={[
            styles.supportingText,
            supportingTone === "success"
              ? styles.supportingTextSuccess
              : supportingTone === "error"
                ? styles.supportingTextError
                : undefined,
          ]}
        >
          {supportingText}
        </Text>
      ) : null}
    </StyleGroup>
  );
}

function StyleGroup({
  children,
  containerStyle,
}: {
  children: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return <View style={[baseStyles.group, containerStyle]}>{children}</View>;
}

const baseStyles = StyleSheet.create({
  group: {
    gap: 6,
  },
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    containerSuccess: {
      borderColor: colors.successBorder,
    },
    containerError: {
      borderColor: colors.dangerBorder,
    },
    input: {
      color: colors.text,
      fontSize: FONT_SIZE.button,
    },
    inputMultiline: {
      minHeight: 96,
    },
    supportingText: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.inputLabel,
      paddingHorizontal: 2,
    },
    supportingTextError: {
      color: colors.danger,
    },
    supportingTextSuccess: {
      color: colors.success,
    },
  });
