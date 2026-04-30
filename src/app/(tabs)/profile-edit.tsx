import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { AuthScreenShell } from "@/components/auth-screen-shell";
import { CancelInputIcon } from "@/components/icons/cancel-input-icon";
import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import {
  DEFAULT_OFFLINE_MESSAGE,
  getActionErrorMessage,
} from "@/lib/network";
import {
  USERNAME_VALIDATION_MESSAGE,
  isValidUsername,
  sanitizeUsername,
} from "@/lib/auth-validation";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const GENDER_OPTIONS = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
  { label: "Prefer not to say", value: "prefer_not_to_say" },
] as const;

type GenderValue = (typeof GENDER_OPTIONS)[number]["value"] | "";
type EditFieldKey = "firstName" | "lastName" | "username" | "gender" | "bio";
type UsernameAvailabilityState = "idle" | "checking" | "available" | "taken";
const DEFAULT_GENDER: GenderValue = "prefer_not_to_say";

const formatProfileName = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, prefix: string, letter: string) =>
      `${prefix}${letter.toUpperCase()}`
    );

const getInitialGender = (value: string | null | undefined): GenderValue =>
  GENDER_OPTIONS.some((option) => option.value === value) ? (value as GenderValue) : DEFAULT_GENDER;

function FieldCheckIcon({
  color,
  size = 18,
}: {
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.5 12.5L9.5 16.5L18.5 7.5"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </Svg>
  );
}

export default function ProfileEditScreen() {
  const { colors } = useAppTheme();
  const { isConnected, showOfflineToast, showToast } = useNetworkStatus();
  const { isUsernameAvailable, profile, updateCurrentUserProfile, user } = useAuth();
  const router = useRouter();
  const styles = createStyles(colors);
  const scrollViewRef = useRef<ScrollView>(null);
  const firstNameInputRef = useRef<TextInput>(null);
  const lastNameInputRef = useRef<TextInput>(null);
  const usernameInputRef = useRef<TextInput>(null);
  const bioInputRef = useRef<TextInput>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [gender, setGender] = useState<GenderValue>(DEFAULT_GENDER);
  const [isGenderSelectorOpen, setIsGenderSelectorOpen] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [activeField, setActiveField] = useState<EditFieldKey | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<EditFieldKey, boolean>>({
    firstName: false,
    lastName: false,
    username: false,
    gender: false,
    bio: false,
  });
  const [usernameAvailability, setUsernameAvailability] =
    useState<UsernameAvailabilityState>("idle");

  useEffect(() => {
    if (!profile) {
      return;
    }

    setFirstName(formatProfileName(profile.firstName));
    setLastName(formatProfileName(profile.lastName));
    setUsernameInput(profile.username);
    setGender(getInitialGender(profile.gender));
    setBioInput(profile.bio.slice(0, 60));
    setHasSubmitted(false);
    setTouchedFields({
      firstName: false,
      lastName: false,
      username: false,
      gender: false,
      bio: false,
    });
  }, [profile]);

  const normalizedFirstName = formatProfileName(firstName);
  const normalizedLastName = formatProfileName(lastName);
  const normalizedUsername = usernameInput.trim().toLowerCase();
  const normalizedCurrentUsername = profile?.username.trim().toLowerCase() ?? "";
  const normalizedBio = bioInput.trim().slice(0, 60);
  const normalizedGender = gender.trim();
  const shouldShowFirstNameError = touchedFields.firstName || hasSubmitted;
  const shouldShowLastNameError = touchedFields.lastName || hasSubmitted;
  const shouldShowUsernameError = touchedFields.username || hasSubmitted;
  const shouldShowGenderError = touchedFields.gender || hasSubmitted;
  const shouldShowBioError = touchedFields.bio || hasSubmitted;
  const firstNameHasError = !normalizedFirstName;
  const lastNameHasError = false;
  const usernameFormatHasError = !normalizedUsername || !isValidUsername(normalizedUsername);
  const usernameTakenHasError =
    !usernameFormatHasError &&
    normalizedUsername !== normalizedCurrentUsername &&
    usernameAvailability === "taken";
  const genderHasError = !normalizedGender;
  const bioHasError = !normalizedBio;
  const showUsernameInvalidState =
    Boolean(normalizedUsername) && (usernameFormatHasError || usernameTakenHasError);
  const showFirstNameError = shouldShowFirstNameError && firstNameHasError;
  const showLastNameError = shouldShowLastNameError && lastNameHasError;
  const showGenderError = shouldShowGenderError && genderHasError;
  const showBioError = shouldShowBioError && bioHasError;
  const showFirstNameValid = touchedFields.firstName && !firstNameHasError;
  const showLastNameValid = touchedFields.lastName && Boolean(normalizedLastName);
  const showGenderValid = touchedFields.gender && !genderHasError;
  const showBioValid = touchedFields.bio && !bioHasError;
  const firstNameError = showFirstNameError ? "First name is required." : "";
  const lastNameError = showLastNameError ? "Last name is required." : "";
  const usernameError = shouldShowUsernameError
    ? !normalizedUsername
      ? "Username is required."
      : !isValidUsername(normalizedUsername)
        ? USERNAME_VALIDATION_MESSAGE
        : usernameTakenHasError
          ? "This username is already taken."
          : ""
    : "";
  const genderError = showGenderError ? "Gender is required." : "";
  const bioError = showBioError ? "Bio is required." : "";
  const showUsernameValid =
    Boolean(normalizedUsername) &&
    !showUsernameInvalidState &&
    usernameAvailability === "available";
  const blockingValidationError =
    firstNameHasError ||
    usernameFormatHasError ||
    usernameTakenHasError ||
    genderHasError ||
    bioHasError;

  const clearProfileError = () => {
    if (profileError) {
      setProfileError("");
    }
  };

  const markFieldTouched = (field: EditFieldKey) => {
    setTouchedFields((currentFields) =>
      currentFields[field] ? currentFields : { ...currentFields, [field]: true }
    );
  };

  const focusField = (field: EditFieldKey) => {
    setActiveField(field);

    switch (field) {
      case "firstName":
        firstNameInputRef.current?.focus();
        return;
      case "lastName":
        lastNameInputRef.current?.focus();
        return;
      case "username":
        usernameInputRef.current?.focus();
        return;
      case "gender":
        return;
      case "bio":
        bioInputRef.current?.focus();
        return;
    }
  };

  const handleFieldBlur = (field: EditFieldKey) => {
    markFieldTouched(field);
    setActiveField((currentField) => (currentField === field ? null : currentField));
  };

  const handleGenderSelect = (nextGender: GenderValue) => {
    clearProfileError();
    markFieldTouched("gender");
    setActiveField(null);
    setGender(nextGender);
    setIsGenderSelectorOpen(false);
  };

  const suggestedUsernameBase =
    sanitizeUsername(`${normalizedFirstName}.${normalizedLastName}`) ||
    sanitizeUsername(`${normalizedFirstName}${normalizedLastName}`) ||
    sanitizeUsername(usernameInput);
  const usernameSuggestion = (() => {
    const baseCandidate = suggestedUsernameBase || "user";
    const candidatePool = [
      baseCandidate,
      (() => {
        const suffix = (user?.uid ?? "").slice(0, 4).toLowerCase();
        if (!suffix) {
          return "";
        }
        const head = baseCandidate.slice(0, Math.max(0, 20 - suffix.length - 1)) || "user";
        return `${head}_${suffix}`;
      })(),
    ];

    return (
      candidatePool.find(
        (candidate) =>
          candidate &&
          candidate !== normalizedUsername &&
          candidate !== normalizedCurrentUsername &&
          isValidUsername(candidate)
      ) ?? ""
    );
  })();
  const selectedGenderLabel =
    GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? "";
  const usernameHint =
    usernameAvailability === "checking"
      ? "Checking username availability..."
      : usernameSuggestion && usernameTakenHasError
        ? `Try ${usernameSuggestion}`
        : usernameSuggestion && !normalizedUsername
          ? `Suggestion: ${usernameSuggestion}`
          : normalizedUsername && normalizedUsername === normalizedCurrentUsername
            ? "This is your current username."
            : normalizedUsername &&
                !usernameFormatHasError &&
                usernameAvailability === "available"
              ? "Username is available."
              : "3-20 characters. Use letters, numbers, dot, underscore, or hyphen.";
  const bioHint = normalizedBio
    ? `${normalizedBio.length}/60 characters. Keep it short and readable.`
    : "Add a short intro so people know what you write about.";
  const genderHint = selectedGenderLabel
    ? `${selectedGenderLabel} will be saved with your profile.`
    : "Choose a gender before saving your profile.";
  const isSaveDisabled =
    isSaving || usernameAvailability === "checking" || blockingValidationError;

  useEffect(() => {
    if (!normalizedUsername) {
      setUsernameAvailability("idle");
      return;
    }

    if (!isValidUsername(normalizedUsername)) {
      setUsernameAvailability("idle");
      return;
    }

    if (normalizedUsername === normalizedCurrentUsername) {
      setUsernameAvailability("available");
      return;
    }

    let isCancelled = false;
    setUsernameAvailability("checking");

    const timeoutId = setTimeout(() => {
      void isUsernameAvailable(normalizedUsername, user?.uid)
        .then((isAvailable) => {
          if (!isCancelled) {
            setUsernameAvailability(isAvailable ? "available" : "taken");
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setUsernameAvailability("idle");
          }
        });
    }, 260);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isUsernameAvailable, normalizedCurrentUsername, normalizedUsername, user?.uid]);

  if (user && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const handleSaveProfile = async () => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    setHasSubmitted(true);

    if (blockingValidationError || usernameAvailability === "checking") {
      return;
    }

    try {
      setIsSaving(true);
      setProfileError("");

      await updateCurrentUserProfile({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        username: normalizedUsername,
        photoURL: profile?.photoURL || user?.photoURL || "",
        bio: normalizedBio,
        gender: normalizedGender,
      });

      showToast("Profile updated.");
      router.replace("/profile");
    } catch (profileActionError) {
      const message = getActionErrorMessage({
        error: profileActionError,
        isConnected,
        fallbackMessage: "Unable to update your profile right now.",
      });

      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
      }

      setProfileError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const scrollBioIntoView = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 180);
  };

  return (
    <AuthScreenShell
      eyebrow=""
      title="Edit Profile"
      subtitle="Update the details people see on your profile."
      showTopBar={false}
      showHero={false}
      topAligned
      backgroundColor={colors.surface}
      safeAreaEdges={["bottom"]}
      scrollViewRef={scrollViewRef}
      scrollContentStyle={styles.compactScrollContent}
      layoutStyle={styles.compactLayout}
    >
      <View style={styles.formStack}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>Edit Profile</Text>
          <Text style={styles.screenSubtitle}>
            Update the details people see on your profile.
          </Text>
        </View>

        {profileError ? (
          <View style={[styles.feedbackCard, styles.feedbackCardError]}>
            <Text style={styles.feedbackTextError}>{profileError}</Text>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <View style={[styles.field, styles.flexField]}>
            <Pressable
              onPress={() => focusField("firstName")}
              style={({ pressed }) => [
                styles.inlineField,
                showFirstNameError && styles.inlineFieldError,
                showFirstNameValid && styles.inlineFieldValid,
                activeField === "firstName" &&
                  !showFirstNameError &&
                  !showFirstNameValid &&
                  styles.inlineFieldActive,
                pressed && styles.inlineFieldPressed,
              ]}
            >
              <Text style={[styles.label, activeField === "firstName" && styles.labelActive]}>
                First Name
              </Text>
              <TextInput
                ref={firstNameInputRef}
                value={firstName}
                onChangeText={(value) => {
                  setFirstName(value);
                  clearProfileError();
                }}
                onFocus={() => setActiveField("firstName")}
                onBlur={() => {
                  setFirstName((currentValue) => formatProfileName(currentValue));
                  handleFieldBlur("firstName");
                }}
                onSubmitEditing={() => focusField("lastName")}
                placeholder="First name"
                placeholderTextColor={colors.placeholderText}
                autoCapitalize="words"
                returnKeyType="next"
                style={styles.input}
              />
            </Pressable>
            <Text style={[styles.helperText, firstNameError && styles.helperTextError]}>
              {firstNameError || "This is shown with your profile name."}
            </Text>
          </View>

          <View style={[styles.field, styles.flexField]}>
            <Pressable
              onPress={() => focusField("lastName")}
              style={({ pressed }) => [
                styles.inlineField,
                showLastNameError && styles.inlineFieldError,
                showLastNameValid && styles.inlineFieldValid,
                activeField === "lastName" &&
                  !showLastNameError &&
                  !showLastNameValid &&
                  styles.inlineFieldActive,
                pressed && styles.inlineFieldPressed,
              ]}
            >
              <Text style={[styles.label, activeField === "lastName" && styles.labelActive]}>
                Last Name
              </Text>
              <TextInput
                ref={lastNameInputRef}
                value={lastName}
                onChangeText={(value) => {
                  setLastName(value);
                  clearProfileError();
                }}
                onFocus={() => setActiveField("lastName")}
                onBlur={() => {
                  setLastName((currentValue) => formatProfileName(currentValue));
                  handleFieldBlur("lastName");
                }}
                onSubmitEditing={() => focusField("username")}
                placeholder="Last name"
                placeholderTextColor={colors.placeholderText}
                autoCapitalize="words"
                returnKeyType="next"
                style={styles.input}
              />
            </Pressable>
            <Text style={[styles.helperText, lastNameError && styles.helperTextError]}>
              {lastNameError || "Optional. Use the name people know you by."}
            </Text>
          </View>
        </View>

        <View style={styles.field}>
          <Pressable
            onPress={() => focusField("username")}
            style={({ pressed }) => [
              styles.inlineField,
              showUsernameInvalidState && styles.inlineFieldError,
              showUsernameValid && styles.inlineFieldValid,
              activeField === "username" &&
                !showUsernameInvalidState &&
                !showUsernameValid &&
                styles.inlineFieldActive,
              pressed && styles.inlineFieldPressed,
            ]}
          >
                <Text style={[styles.label, activeField === "username" && styles.labelActive]}>
                  Username
                </Text>
                <View style={styles.inputValueRow}>
                  <TextInput
                    ref={usernameInputRef}
                    value={usernameInput}
                    onChangeText={(value) => {
                      setUsernameInput(value.replace(/\s+/g, "").toLowerCase());
                      clearProfileError();
                    }}
                    onFocus={() => setActiveField("username")}
                    onBlur={() => handleFieldBlur("username")}
                    onSubmitEditing={() => focusField("bio")}
                    placeholder="Username"
                    placeholderTextColor={colors.placeholderText}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    style={[styles.input, styles.inputValueText]}
                  />
                  <View style={styles.inputAdornment}>
                    {usernameAvailability === "checking" ? (
                      <ActivityIndicator size="small" color={colors.mutedText} />
                    ) : showUsernameInvalidState ? (
                      <CancelInputIcon color={colors.danger} size={18} />
                    ) : showUsernameValid ? (
                      <FieldCheckIcon color={colors.success} size={18} />
                    ) : null}
                  </View>
                </View>
              </Pressable>
          <Text
            style={[
              styles.helperText,
              usernameError && styles.helperTextError,
              showUsernameValid && styles.helperTextSuccess,
            ]}
          >
            {usernameError || usernameHint}
          </Text>
          {usernameError && usernameSuggestion ? (
            <Text style={styles.helperText}>Suggestion: {usernameSuggestion}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Pressable
            onPress={() => {
              markFieldTouched("gender");
              setActiveField("gender");
              setIsGenderSelectorOpen(true);
            }}
            style={({ pressed }) => [
              styles.inlineField,
              styles.selectorField,
              showGenderError && styles.inlineFieldError,
              showGenderValid && styles.inlineFieldValid,
              activeField === "gender" &&
                !showGenderError &&
                !showGenderValid &&
                styles.inlineFieldActive,
              pressed && styles.inlineFieldPressed,
            ]}
          >
            <Text style={[styles.label, activeField === "gender" && styles.labelActive]}>
              Gender
            </Text>
            <View style={styles.selectorValueRow}>
              <Text style={styles.selectorValueText}>
                {selectedGenderLabel || "Select gender"}
              </Text>
              <Text style={styles.selectorValueMeta}>Select</Text>
            </View>
          </Pressable>
          <Text
            style={[
              styles.helperText,
              genderError && styles.helperTextError,
              showGenderValid && styles.helperTextSuccess,
            ]}
          >
            {genderError || genderHint}
          </Text>
        </View>

        <View style={styles.field}>
          <Pressable
            onPress={() => focusField("bio")}
            style={({ pressed }) => [
              styles.inlineField,
              styles.inlineFieldMultiline,
              showBioError && styles.inlineFieldError,
              showBioValid && styles.inlineFieldValid,
              activeField === "bio" &&
                !showBioError &&
                !showBioValid &&
                styles.inlineFieldActive,
              pressed && styles.inlineFieldPressed,
            ]}
          >
            <View style={styles.inputValueRow}>
              <Text style={[styles.label, activeField === "bio" && styles.labelActive]}>Bio</Text>
              <View style={styles.inputAdornment}>
                {bioInput ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear bio"
                    hitSlop={8}
                    onPress={() => {
                      setBioInput("");
                      clearProfileError();
                    }}
                    style={({ pressed }) => [pressed && styles.buttonPressed]}
                  >
                    <CancelInputIcon color={colors.mutedText} size={18} />
                  </Pressable>
                ) : null}
              </View>
            </View>
            <TextInput
              ref={bioInputRef}
              value={bioInput}
              onChangeText={(value) => {
                setBioInput(value.slice(0, 60));
                clearProfileError();
              }}
              onFocus={() => {
                setActiveField("bio");
                scrollBioIntoView();
              }}
              onBlur={() => handleFieldBlur("bio")}
              placeholder="Tell people about yourself"
              placeholderTextColor={colors.placeholderText}
              multiline
              maxLength={60}
              textAlignVertical="top"
              style={[styles.input, styles.bioInput]}
            />
          </Pressable>
          <Text
            style={[
              styles.helperText,
              bioError && styles.helperTextError,
              showBioValid && styles.helperTextSuccess,
            ]}
          >
            {bioError || bioHint}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [
              styles.rowButton,
              styles.secondaryButton,
              pressed && styles.buttonPressed,
              isSaving && styles.buttonDisabled,
            ]}
            onPress={() => router.replace("/profile")}
            disabled={isSaving}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.rowButton,
              styles.primaryButton,
              isSaveDisabled && styles.primaryButtonDisabled,
              pressed && !isSaveDisabled && styles.buttonPressed,
            ]}
            onPress={() => {
              void handleSaveProfile();
            }}
            disabled={isSaveDisabled}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <Text style={styles.primaryButtonText}>Save Changes</Text>
            )}
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={isGenderSelectorOpen}
        onRequestClose={() => {
          setIsGenderSelectorOpen(false);
          setActiveField(null);
        }}
      >
        <View style={styles.selectorRoot}>
          <Pressable
            style={styles.selectorBackdrop}
            onPress={() => {
              setIsGenderSelectorOpen(false);
              setActiveField(null);
            }}
          />
          <View style={styles.selectorSheet}>
            <View style={styles.selectorHandle} />
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitle}>Select Gender</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.selectorCloseButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  setIsGenderSelectorOpen(false);
                  setActiveField(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Close gender selector"
              >
                <CancelInputIcon color={colors.text} size={18} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.selectorList}
              contentContainerStyle={styles.selectorListContent}
              showsVerticalScrollIndicator={false}
            >
              {GENDER_OPTIONS.map((option) => {
                const isSelected = gender === option.value;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => handleGenderSelect(option.value)}
                    style={({ pressed }) => [
                      styles.selectorOption,
                      isSelected && styles.selectorOptionActive,
                      pressed && styles.genderRowPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectorOptionTitle,
                        isSelected && styles.selectorOptionTitleActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <View style={[styles.genderRadio, isSelected && styles.genderRadioSelected]}>
                      {isSelected ? <View style={styles.genderRadioDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AuthScreenShell>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    formStack: {
      gap: SPACING.md,
    },
    compactScrollContent: {
      paddingTop: 0,
    },
    compactLayout: {
      paddingTop: SPACING.lg,
    },
    screenHeader: {
      gap: SPACING.xs,
      paddingBottom: SPACING.sm,
    },
    screenTitle: {
      color: colors.text,
      fontSize: 28,
      lineHeight: 32,
      fontWeight: "800",
    },
    screenSubtitle: {
      color: colors.mutedText,
      fontSize: 15,
      lineHeight: 22,
    },
    field: {
      gap: SPACING.xs,
    },
    flexField: {
      flex: 1,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.md,
    },
    inlineField: {
      minHeight: 74,
      justifyContent: "flex-end",
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      backgroundColor: colors.surface,
    },
    inlineFieldMultiline: {
      minHeight: 136,
      paddingBottom: SPACING.md,
    },
    selectorField: {
      minHeight: 82,
      justifyContent: "center",
      gap: SPACING.xs,
    },
    inlineFieldActive: {
      borderBottomColor: colors.text,
    },
    inlineFieldError: {
      borderBottomColor: colors.danger,
    },
    inlineFieldValid: {
      borderBottomColor: colors.success,
    },
    inlineFieldPressed: {
      opacity: 0.88,
    },
    label: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
      letterSpacing: 0.1,
    },
    labelActive: {
      color: colors.text,
    },
    selectorValueRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
    },
    inputValueRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
    },
    selectorValueText: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "600",
    },
    selectorValueMeta: {
      color: colors.accent,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
    },
    input: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "600",
      paddingHorizontal: 0,
      paddingVertical: 0,
      margin: 0,
    },
    inputValueText: {
      flex: 1,
    },
    inputAdornment: {
      minWidth: 20,
      minHeight: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    bioInput: {
      minHeight: 92,
      paddingTop: SPACING.xs,
      textAlignVertical: "top",
      lineHeight: 24,
    },
    helperText: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
    },
    helperTextError: {
      color: colors.danger,
    },
    helperTextSuccess: {
      color: colors.success,
    },
    genderRowPressed: {
      opacity: 0.92,
    },
    genderRadio: {
      width: 22,
      height: 22,
      borderRadius: RADIUS.pill,
      borderWidth: 1.5,
      borderColor: colors.divider,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    genderRadioSelected: {
      borderColor: colors.accent,
    },
    genderRadioDot: {
      width: 10,
      height: 10,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.accent,
    },
    selectorRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    selectorBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    selectorSheet: {
      maxHeight: "70%",
      borderTopLeftRadius: RADIUS.lg,
      borderTopRightRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.xl,
      gap: SPACING.md,
    },
    selectorHandle: {
      alignSelf: "center",
      width: 44,
      height: 4,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.divider,
    },
    selectorHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
    },
    selectorTitle: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "700",
    },
    selectorCloseButton: {
      minHeight: 38,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    selectorCloseText: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
    },
    selectorList: {
      flexGrow: 0,
    },
    selectorListContent: {
      gap: SPACING.sm,
    },
    selectorOption: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
    },
    selectorOptionActive: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.activeSurface,
    },
    selectorOptionTitle: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "600",
    },
    selectorOptionTitleActive: {
      color: colors.primary,
    },
    feedbackCard: {
      borderLeftWidth: 3,
      paddingLeft: SPACING.md,
      paddingVertical: SPACING.xs,
    },
    feedbackCardError: {
      borderLeftColor: colors.danger,
    },
    feedbackTextError: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 19,
    },
    buttonRow: {
      flexDirection: "row",
      gap: SPACING.sm,
      paddingTop: SPACING.md,
    },
    rowButton: {
      flex: 1,
    },
    primaryButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    primaryButtonDisabled: {
      opacity: 0.55,
    },
    primaryButtonText: {
      color: colors.primaryText,
      fontSize: FONT_SIZE.button,
      fontWeight: "700",
    },
    secondaryButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: FONT_SIZE.button,
      fontWeight: "700",
    },
    buttonPressed: {
      opacity: 0.9,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });