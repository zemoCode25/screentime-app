import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useAuth } from "@/src/features/auth/hooks/use-auth";

export default function SignupScreen() {
  const { signUp } = useAuth();
  const colorScheme = useColorScheme() ?? "light";
  const textColor = useThemeColor({}, "text");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputBorderColor = colorScheme === "dark" ? "#30363d" : "#d0d7de";
  const inputBackgroundColor = colorScheme === "dark" ? "#1c1f22" : "#fff";
  const placeholderColor = colorScheme === "dark" ? "#9aa0a6" : "#6b7280";
  const buttonColor = Colors.light.tint;

  const handleSignup = async () => {
    setErrorMessage(null);
    setNoticeMessage(null);
    setIsSubmitting(true);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage("Email and password are required.");
      setIsSubmitting(false);
      return;
    }
    const { error, needsConfirmation } = await signUp(
      trimmedEmail,
      password,
      displayName
    );
    if (error) {
      setErrorMessage(error);
    }
    if (needsConfirmation) {
      setNoticeMessage("Check your email to confirm your account.");
    }
    setIsSubmitting(false);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Create parent account</ThemedText>
        <ThemedText style={styles.subtitle}>
          Parents create accounts and add child profiles later.
        </ThemedText>
      </View>

      <View style={styles.form}>
        <TextInput
          autoCapitalize="words"
          autoComplete="name"
          placeholder="Parent name"
          placeholderTextColor={placeholderColor}
          style={[
            styles.input,
            {
              color: textColor,
              borderColor: inputBorderColor,
              backgroundColor: inputBackgroundColor,
            },
          ]}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={placeholderColor}
          style={[
            styles.input,
            {
              color: textColor,
              borderColor: inputBorderColor,
              backgroundColor: inputBackgroundColor,
            },
          ]}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="password"
          placeholder="Password"
          placeholderTextColor={placeholderColor}
          secureTextEntry
          style={[
            styles.input,
            {
              color: textColor,
              borderColor: inputBorderColor,
              backgroundColor: inputBackgroundColor,
            },
          ]}
          value={password}
          onChangeText={setPassword}
        />

        {errorMessage ? (
          <ThemedText lightColor="#b91c1c" darkColor="#f87171">
            {errorMessage}
          </ThemedText>
        ) : null}
        {noticeMessage ? (
          <ThemedText lightColor="#0f766e" darkColor="#5eead4">
            {noticeMessage}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={handleSignup}
          disabled={isSubmitting}
          style={[
            styles.button,
            { backgroundColor: buttonColor },
            isSubmitting && styles.buttonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText lightColor="#fff" darkColor="#fff" style={styles.buttonText}>
              Create account
            </ThemedText>
          )}
        </Pressable>
      </View>

      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>Already have an account?</ThemedText>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <ThemedText type="link">Sign in</ThemedText>
          </Pressable>
        </Link>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  subtitle: {
    marginTop: 8,
    opacity: 0.7,
  },
  form: {
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerText: {
    opacity: 0.7,
    marginRight: 8,
  },
});
