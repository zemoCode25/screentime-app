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

export default function LoginScreen() {
  const { signIn } = useAuth();
  const colorScheme = useColorScheme() ?? "light";
  const textColor = useThemeColor({}, "text");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputBorderColor = colorScheme === "dark" ? "#30363d" : "#d0d7de";
  const inputBackgroundColor = colorScheme === "dark" ? "#1c1f22" : "#fff";
  const placeholderColor = colorScheme === "dark" ? "#9aa0a6" : "#6b7280";
  const buttonColor = Colors.light.tint;

  const handleLogin = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage("Email and password are required.");
      setIsSubmitting(false);
      return;
    }
    const { error } = await signIn(trimmedEmail, password);
    if (error) {
      setErrorMessage(error);
    }
    setIsSubmitting(false);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Welcome back</ThemedText>
        <ThemedText style={styles.subtitle}>
          Sign in to manage your family account.
        </ThemedText>
      </View>

      <View style={styles.form}>
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

        <Pressable
          onPress={handleLogin}
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
              Sign in
            </ThemedText>
          )}
        </Pressable>
      </View>

      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>New here?</ThemedText>
        <Link href="/(auth)/signup" asChild>
          <Pressable>
            <ThemedText type="link">Create a parent account</ThemedText>
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
