import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useChildProfile } from "@/src/features/child/hooks/use-child-data";
import { useCreateOverrideRequest } from "@/src/features/child/hooks/use-override-request";

type BlockReason = "bedtime" | "focus" | "daily_limit" | "app_limit";

type BlockReasonConfig = {
  title: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  showRequestButton: boolean;
  footerText: string;
};

const BLOCK_REASON_CONFIG: Record<BlockReason, BlockReasonConfig> = {
  bedtime: {
    title: "It's Bedtime",
    message: "Time to rest! Screen time is paused until morning.",
    icon: "moon",
    iconColor: "#6366f1",
    showRequestButton: false,
    footerText: "Get some rest and try again tomorrow!",
  },
  focus: {
    title: "Focus Time Active",
    message: "Stay focused! Apps are blocked during this time.",
    icon: "flash",
    iconColor: "#f59e0b",
    showRequestButton: false,
    footerText: "Focus time helps you concentrate on important tasks.",
  },
  daily_limit: {
    title: "Daily Limit Reached",
    message: "You've used all your screen time for today.",
    icon: "timer-outline",
    iconColor: "#ef4444",
    showRequestButton: true,
    footerText: "Ask your parent if you need access for homework or important tasks.",
  },
  app_limit: {
    title: "App Limit Reached",
    message: "You've reached your daily limit for this app.",
    icon: "lock-closed",
    iconColor: "#ef4444",
    showRequestButton: true,
    footerText: "Ask your parent if you need access for homework or important tasks.",
  },
};

export default function BlockedAppScreen() {
  const params = useLocalSearchParams<{
    packageName?: string;
    appName?: string;
    blockReason?: string;
  }>();
  const { data: childProfile } = useChildProfile();
  const createOverrideRequest = useCreateOverrideRequest();

  const [requestSent, setRequestSent] = useState(false);

  const packageName = params.packageName ?? "unknown";
  const appName = params.appName ?? "This app";
  const blockReason = (params.blockReason as BlockReason) || "app_limit";
  const config = BLOCK_REASON_CONFIG[blockReason] ?? BLOCK_REASON_CONFIG.app_limit;

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
      Alert.alert("Error", "Failed to send request. Please try again.");
    }
  };

  const handleGoHome = () => {
    // Go to home launcher
    router.replace("/(child)/home");
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={config.icon} size={80} color={config.iconColor} />
      </View>

      <Text style={styles.title}>{config.title}</Text>

      <Text style={styles.appName}>{appName}</Text>

      <Text style={styles.message}>{config.message}</Text>

      <View style={styles.buttonContainer}>
        {config.showRequestButton && (
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
        )}

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
        <Text style={styles.footerText}>{config.footerText}</Text>
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
