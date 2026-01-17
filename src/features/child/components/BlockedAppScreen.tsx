import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  NativeModules,
  BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type BlockReason = "bedtime" | "focus" | "daily_limit" | "app_limit";

type BlockReasonConfig = {
  title: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  footerText: string;
};

const BLOCK_REASON_CONFIG: Record<BlockReason, BlockReasonConfig> = {
  bedtime: {
    title: "It's Bedtime",
    message: "Time to rest! Screen time is paused until morning.",
    icon: "moon",
    iconColor: "#6366f1",
    footerText: "Get some rest and try again tomorrow!",
  },
  focus: {
    title: "Focus Time Active",
    message: "Stay focused! Apps are blocked during this time.",
    icon: "flash",
    iconColor: "#f59e0b",
    footerText: "Focus time helps you concentrate on important tasks.",
  },
  daily_limit: {
    title: "Daily Limit Reached",
    message: "You've used all your screen time for today.",
    icon: "timer-outline",
    iconColor: "#ef4444",
    footerText: "Your screen time will reset tomorrow.",
  },
  app_limit: {
    title: "App Limit Reached",
    message: "You've reached your daily limit for this app.",
    icon: "lock-closed",
    iconColor: "#ef4444",
    footerText: "Try using a different app or take a break.",
  },
};

interface Props {
  blockedPackage?: string;
  blockReason?: string;
}

/**
 * Standalone blocked app screen that doesn't use expo-router.
 * This is launched by BlockingActivity as a separate React Native root.
 */
export default function BlockedAppScreen({ blockedPackage, blockReason }: Props) {
  const reason = (blockReason as BlockReason) || "app_limit";
  const config = BLOCK_REASON_CONFIG[reason] ?? BLOCK_REASON_CONFIG.app_limit;

  const handleGoHome = () => {
    // Use BackHandler to trigger the native back action
    // BlockingActivity handles this by going to home launcher
    BackHandler.exitApp();
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={config.icon} size={80} color={config.iconColor} />
      </View>

      <Text style={styles.title}>{config.title}</Text>

      {blockedPackage && (
        <Text style={styles.appName}>{blockedPackage}</Text>
      )}

      <Text style={styles.message}>{config.message}</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleGoHome}
        >
          <Ionicons name="home-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>Go Home</Text>
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
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
    fontFamily: "monospace",
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
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
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
