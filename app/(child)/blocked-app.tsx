import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "@/src/contexts/auth-context";
import { useCreateOverrideRequest } from "@/src/features/child/hooks/use-override-request";
import { useChildProfile } from "@/src/features/child/hooks/use-child-profile";

export default function BlockedAppScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ packageName?: string; appName?: string }>();
  const { data: childProfile } = useChildProfile(user?.id);
  const createOverrideRequest = useCreateOverrideRequest();

  const [requestSent, setRequestSent] = useState(false);

  const packageName = params.packageName ?? "unknown";
  const appName = params.appName ?? "This app";

  useEffect(() => {
    // If no package name is provided, go back home
    if (!packageName || packageName === "unknown") {
      router.replace("/(child)/home");
    }
  }, [packageName]);

  const handleRequestMoreTime = async () => {
    if (!childProfile) {
      Alert.alert("Error", "Could not load your profile");
      return;
    }

    try {
      await createOverrideRequest.mutateAsync({
        childId: childProfile.id,
        packageName,
        appName,
      });
      setRequestSent(true);
      Alert.alert(
        "Request Sent",
        "Your request for more time has been sent to your parent. They will review it soon.",
        [
          {
            text: "OK",
            onPress: handleGoHome,
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to send request. Please try again."
      );
    }
  };

  const handleGoHome = () => {
    // Go to home launcher
    router.replace("/(child)/home");
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="lock-closed" size={80} color="#ef4444" />
      </View>

      <Text style={styles.title}>Screen Time Limit Reached</Text>

      <Text style={styles.appName}>{appName}</Text>

      <Text style={styles.message}>
        You've reached your daily screen time limit for this app.
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.primaryButton,
            requestSent && styles.disabledButton,
          ]}
          onPress={handleRequestMoreTime}
          disabled={requestSent || createOverrideRequest.isPending}
        >
          {createOverrideRequest.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="time-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {requestSent ? "Request Sent" : "Request More Time"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleGoHome}
        >
          <Ionicons name="home-outline" size={20} color="#64748b" />
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Go Home
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Ask your parent if you need access for homework or important tasks
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  appName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
  },
  disabledButton: {
    backgroundColor: "#94a3b8",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  secondaryButtonText: {
    color: "#64748b",
  },
  footer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  footerText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
  },
});
