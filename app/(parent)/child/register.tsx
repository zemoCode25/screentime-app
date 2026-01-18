import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCreateChild } from "@/src/features/parent/hooks/use-children";
import {
  childSchema,
  type ChildFormValues,
  type MotivationValue,
} from "@/src/features/parent/validation/child-schema";

const COLORS = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#DBEAFE",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#64748B",
  border: "#E2E8F0",
  error: "#DC2626",
  errorLight: "#FEF2F2",
  shadow: "#64748B",
};

const INTEREST_OPTIONS = [
  "Reading",
  "Sports",
  "Music",
  "Coding",
  "Art",
  "Gaming",
  "Outdoors",
  "Science",
  "Robotics",
  "Cooking",
];

const MOTIVATION_OPTIONS: Array<{ label: string; value: MotivationValue }> = [
  { label: "Better Focus", value: "habit_boredom" },
  { label: "Homework Help", value: "learning_education" },
  { label: "Better Sleep", value: "relaxation_stress_relief" },
  { label: "Manage Gaming", value: "gaming" },
  { label: "Safe Socializing", value: "social_communication" },
  { label: "Create More", value: "creativity" },
];

export default function ChildRegisterScreen() {
  const router = useRouter();
  const { mutateAsync: createChild, isPending } = useCreateChild();
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ChildFormValues>({
    defaultValues: {
      name: "",
      childEmail: "",
      age: "",
      gradeLevel: "",
      interests: [],
      motivations: [],
    },
    mode: "onTouched",
  });

  const isBusy = isSubmitting || isPending;

  const handleCreate = handleSubmit(async (values) => {
    clearErrors("root");
    try {
      await createChild({
        name: values.name.trim(),
        childEmail: values.childEmail.trim().toLowerCase(),
        age: Number(values.age),
        gradeLevel: values.gradeLevel?.trim() || null,
        interests: values.interests,
        motivations: values.motivations,
      });
      router.replace("/(parent)/home");
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Unable to create child.",
      });
    }
  });

  const toggleSelection = <T,>(current: T[], option: T) => {
    if (current.includes(option)) {
      return current.filter((item) => item !== option);
    }
    return [...current, option];
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            </Pressable>
            <View>
              <Text style={styles.title}>Register Child</Text>
              <Text style={styles.subtitle}>
                Create a profile to foster healthy habits.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            {errors.root?.message ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                <Text style={styles.errorText}>{errors.root.message}</Text>
              </View>
            ) : null}

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Basic Info</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Child Name</Text>
                <Controller
                  control={control}
                  name="name"
                  rules={{
                    validate: (value) => {
                      const result = childSchema.shape.name.safeParse(value);
                      return result.success || result.error.issues[0]?.message;
                    },
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View
                      style={[
                        styles.inputContainer,
                        errors.name && styles.inputError,
                      ]}
                    >
                      <TextInput
                        placeholder="e.g. Jordan"
                        placeholderTextColor={COLORS.textSecondary}
                        style={styles.input}
                        value={value}
                        onChangeText={(text) => {
                          onChange(text);
                          clearErrors("root");
                        }}
                        onBlur={onBlur}
                      />
                    </View>
                  )}
                />
                {errors.name?.message ? (
                  <Text style={styles.fieldError}>{errors.name.message}</Text>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Child Email</Text>
                <Controller
                  control={control}
                  name="childEmail"
                  rules={{
                    validate: (value) => {
                      const result =
                        childSchema.shape.childEmail.safeParse(value);
                      return result.success || result.error.issues[0]?.message;
                    },
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View
                      style={[
                        styles.inputContainer,
                        errors.childEmail && styles.inputError,
                      ]}
                    >
                      <TextInput
                        placeholder="kid@example.com"
                        placeholderTextColor={COLORS.textSecondary}
                        style={styles.input}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={value}
                        onChangeText={(text) => {
                          onChange(text);
                          clearErrors("root");
                        }}
                        onBlur={onBlur}
                      />
                    </View>
                  )}
                />
                {errors.childEmail?.message ? (
                  <Text style={styles.fieldError}>
                    {errors.childEmail.message}
                  </Text>
                ) : null}
              </View>

              <View style={styles.inlineFields}>
                <View style={styles.inlineField}>
                  <Text style={styles.label}>Age</Text>
                  <Controller
                    control={control}
                    name="age"
                    rules={{
                      validate: (value) => {
                        const result = childSchema.shape.age.safeParse(value);
                        return (
                          result.success || result.error.issues[0]?.message
                        );
                      },
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View
                        style={[
                          styles.inputContainer,
                          errors.age && styles.inputError,
                        ]}
                      >
                        <TextInput
                          placeholder="10"
                          placeholderTextColor={COLORS.textSecondary}
                          style={styles.input}
                          keyboardType="number-pad"
                          value={value}
                          onChangeText={(text) => {
                            onChange(text);
                            clearErrors("root");
                          }}
                          onBlur={onBlur}
                        />
                      </View>
                    )}
                  />
                  {errors.age?.message ? (
                    <Text style={styles.fieldError}>{errors.age.message}</Text>
                  ) : null}
                </View>

                <View style={styles.inlineField}>
                  <Text style={styles.label}>Grade (Optional)</Text>
                  <Controller
                    control={control}
                    name="gradeLevel"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View style={styles.inputContainer}>
                        <TextInput
                          placeholder="e.g. 5th Grade"
                          placeholderTextColor={COLORS.textSecondary}
                          style={styles.input}
                          value={value}
                          onChangeText={(text) => {
                            onChange(text);
                            clearErrors("root");
                          }}
                          onBlur={onBlur}
                        />
                      </View>
                    )}
                  />
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <Text style={styles.sectionDescription}>
                What do they enjoy doing?
              </Text>
              <Controller
                control={control}
                name="interests"
                rules={{
                  validate: (value) => {
                    const result = childSchema.shape.interests.safeParse(value);
                    return result.success || result.error.issues[0]?.message;
                  },
                }}
                render={({ field: { value, onChange } }) => (
                  <View>
                    <View style={styles.chipRow}>
                      {INTEREST_OPTIONS.map((option) => {
                        const selected = value.includes(option);
                        return (
                          <Pressable
                            key={option}
                            onPress={() => {
                              onChange(toggleSelection(value, option));
                              clearErrors("root");
                            }}
                            style={({ pressed }) => [
                              styles.chip,
                              selected && styles.chipSelected,
                              pressed && styles.chipPressed,
                            ]}
                          >
                            <Text
                              style={
                                selected
                                  ? styles.chipTextSelected
                                  : styles.chipText
                              }
                            >
                              {option}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {errors.interests?.message ? (
                      <Text style={styles.fieldError}>
                        {errors.interests.message}
                      </Text>
                    ) : null}
                  </View>
                )}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Goals</Text>
              <Text style={styles.sectionDescription}>
                Why are you using WellTime for your child?
              </Text>
              <Controller
                control={control}
                name="motivations"
                rules={{
                  validate: (value) => {
                    const result =
                      childSchema.shape.motivations.safeParse(value);
                    return result.success || result.error.issues[0]?.message;
                  },
                }}
                render={({ field: { value, onChange } }) => (
                  <View>
                    <View style={styles.chipRow}>
                      {MOTIVATION_OPTIONS.map((option) => {
                        const selected = value.includes(option.value);
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => {
                              onChange(toggleSelection(value, option.value));
                              clearErrors("root");
                            }}
                            style={({ pressed }) => [
                              styles.chip,
                              selected && styles.chipSelected,
                              pressed && styles.chipPressed,
                            ]}
                          >
                            <Text
                              style={
                                selected
                                  ? styles.chipTextSelected
                                  : styles.chipText
                              }
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {errors.motivations?.message ? (
                      <Text style={styles.fieldError}>
                        {errors.motivations.message}
                      </Text>
                    ) : null}
                  </View>
                )}
              />
            </View>

            <View style={styles.footerSpacing} />

            <Pressable
              onPress={handleCreate}
              disabled={isBusy}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitButtonPressed,
                isBusy && styles.submitButtonDisabled,
              ]}
            >
              {isBusy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Create Profile</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  backgroundGlowTop: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#E0F2FE", // Light blue glow
    top: -100,
    right: -100,
    opacity: 0.6,
  },
  backgroundGlowBottom: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#EFF6FF", // Lighter blue glow
    bottom: -80,
    left: -80,
    opacity: 0.6,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100, // Safe area bottom padding
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonPressed: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryLight,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  card: {
    // Transparent card
    paddingHorizontal: 4,
    gap: 18,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 24,
    opacity: 0.5,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.errorLight,
    marginBottom: 20,
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  formSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  sectionDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: -8,
    marginBottom: 8,
  },
  fieldGroup: {
    gap: 8,
  },
  inlineFields: {
    flexDirection: "row",
    gap: 16,
  },
  inlineField: {
    flex: 1,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text, // Darker label for better visibility
    fontFamily: "Inter_500Medium",
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15, // Slightly larger text
    color: COLORS.text,
    fontFamily: "Inter_400Regular",
  },
  fieldError: {
    fontSize: 12,
    color: COLORS.error,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: "Inter_500Medium",
  },
  chipTextSelected: {
    fontSize: 13,
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
  },
  footerSpacing: {
    height: 24,
  },
  submitButton: {
    height: 52, // Taller button
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonPressed: {
    backgroundColor: COLORS.primaryDark,
    transform: [{ scale: 0.98 }],
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
