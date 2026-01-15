import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
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

import { useAuth } from "@/src/features/auth/hooks/use-auth";
import {
  signupSchema,
  type SignupFormValues,
} from "@/src/features/auth/validation/signup-schema";

// Modern blue accent color palette
const COLORS = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#DBEAFE",
  background: "#FFFFFF",
  surface: "#F8FAFC",
  text: "#1E293B",
  textSecondary: "#94A3B8",
  border: "#E2E8F0",
  error: "#DC2626",
  errorLight: "#FEF2F2",
  success: "#059669",
  successLight: "#D1FAE5",
};

export default function SignupScreen() {
  const { signUp, signInWithGoogle } = useAuth();
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
    },
    mode: "onTouched",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  // Focus states
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSignup = handleSubmit(async (values) => {
    clearErrors("root");
    setNoticeMessage(null);
    const normalizedName = values.displayName?.trim() ?? "";
    const { error, needsConfirmation } = await signUp(
      values.email.trim(),
      values.password,
      normalizedName
    );
    if (error) {
      setError("root", { message: error });
      return;
    }
    if (needsConfirmation) {
      setNoticeMessage("Check your email to confirm your account.");
    }
  });

  const handleGoogleSignup = async () => {
    clearErrors("root");
    setNoticeMessage(null);
    setIsOAuthLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError("root", { message: error });
    }
    setIsOAuthLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Logo / Brand Section */}
          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <Ionicons name="time" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.appName}>ScreenTime</Text>
            <Text style={styles.tagline}>Healthy habits start here</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Form */}
            <View style={styles.form}>
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View
                  style={[
                    styles.inputContainer,
                    nameFocused && styles.inputContainerFocused,
                    errors.displayName && styles.inputContainerError,
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={nameFocused ? COLORS.primary : COLORS.textSecondary}
                    style={styles.inputIcon}
                  />
                  <Controller
                    control={control}
                    name="displayName"
                    rules={{
                      validate: (value) => {
                        const result =
                          signupSchema.shape.displayName.safeParse(value);
                        return (
                          result.success || result.error.issues[0]?.message
                        );
                      },
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        autoCapitalize="words"
                        autoComplete="name"
                        placeholder="Parent Name"
                        placeholderTextColor={COLORS.textSecondary}
                        style={styles.input}
                        value={value ?? ""}
                        onChangeText={(text) => {
                          onChange(text);
                          clearErrors("root");
                          setNoticeMessage(null);
                        }}
                        onFocus={() => setNameFocused(true)}
                        onBlur={() => {
                          onBlur();
                          setNameFocused(false);
                        }}
                      />
                    )}
                  />
                </View>
                {errors.displayName?.message ? (
                  <Text style={styles.fieldError}>
                    {errors.displayName.message}
                  </Text>
                ) : null}
              </View>

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View
                  style={[
                    styles.inputContainer,
                    emailFocused && styles.inputContainerFocused,
                    errors.email && styles.inputContainerError,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={emailFocused ? COLORS.primary : COLORS.textSecondary}
                    style={styles.inputIcon}
                  />
                  <Controller
                    control={control}
                    name="email"
                    rules={{
                      validate: (value) => {
                        const result =
                          signupSchema.shape.email.safeParse(value);
                        return (
                          result.success || result.error.issues[0]?.message
                        );
                      },
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        placeholder="you@example.com"
                        placeholderTextColor={COLORS.textSecondary}
                        style={styles.input}
                        value={value}
                        onChangeText={(text) => {
                          onChange(text);
                          clearErrors("root");
                          setNoticeMessage(null);
                        }}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => {
                          onBlur();
                          setEmailFocused(false);
                        }}
                      />
                    )}
                  />
                </View>
                {errors.email?.message ? (
                  <Text style={styles.fieldError}>{errors.email.message}</Text>
                ) : null}
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View
                  style={[
                    styles.inputContainer,
                    passwordFocused && styles.inputContainerFocused,
                    errors.password && styles.inputContainerError,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={
                      passwordFocused ? COLORS.primary : COLORS.textSecondary
                    }
                    style={styles.inputIcon}
                  />
                  <Controller
                    control={control}
                    name="password"
                    rules={{
                      validate: (value) => {
                        const result =
                          signupSchema.shape.password.safeParse(value);
                        return (
                          result.success || result.error.issues[0]?.message
                        );
                      },
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        autoCapitalize="none"
                        autoComplete="password"
                        placeholder="Create a password"
                        placeholderTextColor={COLORS.textSecondary}
                        secureTextEntry={!showPassword}
                        style={styles.input}
                        value={value}
                        onChangeText={(text) => {
                          onChange(text);
                          clearErrors("root");
                          setNoticeMessage(null);
                        }}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => {
                          onBlur();
                          setPasswordFocused(false);
                        }}
                      />
                    )}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={COLORS.textSecondary}
                    />
                  </Pressable>
                </View>
                {errors.password?.message ? (
                  <Text style={styles.fieldError}>
                    {errors.password.message}
                  </Text>
                ) : null}
              </View>

              {/* Error Message */}
              {errors.root?.message ? (
                <View style={styles.errorContainer}>
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={COLORS.error}
                  />
                  <Text style={styles.errorText}>{errors.root.message}</Text>
                </View>
              ) : null}

              {/* Notice Message */}
              {noticeMessage ? (
                <View style={styles.successContainer}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={COLORS.success}
                  />
                  <Text style={styles.successText}>{noticeMessage}</Text>
                </View>
              ) : null}

              {/* Sign Up Button */}
              <Pressable
                onPress={handleSignup}
                disabled={isSubmitting || isOAuthLoading}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                  (isSubmitting || isOAuthLoading) && styles.buttonDisabled,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Create account</Text>
                )}
              </Pressable>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In */}
            <Pressable
              onPress={handleGoogleSignup}
              disabled={isOAuthLoading || isSubmitting}
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.googleButtonPressed,
                (isOAuthLoading || isSubmitting) && styles.googleButtonDisabled,
              ]}
            >
              {isOAuthLoading ? (
                <ActivityIndicator color={COLORS.text} size="small" />
              ) : (
                <Ionicons name="logo-google" size={20} color={COLORS.text} />
              )}
              <Text style={styles.googleButtonText}>
                {isOAuthLoading ? "Connecting..." : "Continue with Google"}
              </Text>
            </Pressable>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Link href="/(auth)/login" asChild>
                <Pressable hitSlop={8}>
                  {({ pressed }) => (
                    <Text
                      style={[
                        styles.linkText,
                        pressed && styles.linkTextPressed,
                      ]}
                    >
                      Sign in
                    </Text>
                  )}
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: COLORS.background,
  },
  brandSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  appName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
    fontFamily: "Inter_700Bold",
  },
  tagline: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  formCard: {
    width: "100%",
    backgroundColor: COLORS.background,
    padding: 0,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: 10,
  },
  googleButtonPressed: {
    backgroundColor: COLORS.surface,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
    fontFamily: "Inter_500Medium",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text,
    fontFamily: "Inter_500Medium",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    height: 44,
  },
  inputContainerFocused: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  inputContainerError: {
    borderColor: COLORS.error,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 0,
    fontFamily: "Inter_400Regular",
  },
  eyeButton: {
    padding: 4,
  },
  fieldError: {
    fontSize: 12,
    color: COLORS.error,
    fontFamily: "Inter_500Medium",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.errorLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.error,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.success,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    height: 44,
    marginTop: 4,
  },
  buttonPressed: {
    backgroundColor: COLORS.primaryDark,
    opacity: 0.95,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    gap: 4,
  },
  footerText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  linkText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
    fontFamily: "Inter_600SemiBold",
  },
  linkTextPressed: {
    color: COLORS.primaryDark,
  },
});
