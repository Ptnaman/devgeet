import { useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

type AuthEmailFieldProps = TextInputProps & {
  label: string;
  error?: string;
  icon?: ReactNode;
  forceLight?: boolean;
  secure?: boolean;
};

export function AuthEmailField({
  label,
  error,
  icon,
  forceLight = false,
  secure = false,
  style,
  ...inputProps
}: AuthEmailFieldProps) {
  const colors = forceLight ? LIGHT_COLORS : DEFAULT_COLORS;
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const { onBlur, onFocus } = inputProps;
  const isSecureField = secure;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.label }]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          {
            borderColor: error ? "#DC2626" : isFocused ? "#6D28D9" : colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <TextInput
          {...inputProps}
          style={[styles.input, { color: colors.text }, style]}
          secureTextEntry={isSecureField && !isPasswordVisible}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
        />
        {isSecureField ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
            hitSlop={10}
            style={styles.visibilityButton}
            onPress={() => setIsPasswordVisible((visible) => !visible)}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color="#6B7280" strokeWidth={2} />
            ) : (
              <Eye size={20} color="#6B7280" strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const LIGHT_COLORS = {
  background: "#FFFFFF",
  border: "#E5E7EB",
  label: "#374151",
  text: "#111827",
};

const DEFAULT_COLORS = {
  background: "#FFFFFF",
  border: "#E5E7EB",
  label: "#374151",
  text: "#111827",
};

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  inputRow: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  icon: {
    marginRight: 10,
  },
  visibilityButton: {
    width: 32,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  input: {
    flex: 1,
    minHeight: 52,
    fontSize: 16,
    paddingVertical: 0,
  },
  error: {
    color: "#B91C1C",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
});
