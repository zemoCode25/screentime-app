import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { Database } from "@/types/database-types";

type ChildTimeRule = Database["public"]["Tables"]["child_time_rules"]["Row"];

// Notification IDs for constraint alarms
const NOTIFICATION_ID_PREFIX = "constraint_alarm_";
const APP_LIMIT_NOTIFICATION_ID = "app_limit_reached";
const DAILY_LIMIT_NOTIFICATION_ID = "daily_limit_reached";

// Track which notifications we've already shown to avoid duplicates
const shownNotifications = new Set<string>();

// Store the notification listener subscription to avoid duplicate listeners
let notificationListenerSubscription: Notifications.Subscription | null = null;

/**
 * Converts seconds since midnight to hours and minutes
 */
function secondsToTime(seconds: number): { hour: number; minute: number } {
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor((seconds % 3600) / 60);
  return { hour, minute };
}

/**
 * Gets the next occurrence of a specific time on one of the given days
 */
function getNextOccurrence(
  timeSeconds: number,
  days: number[],
  now: Date = new Date()
): Date | null {
  if (days.length === 0) return null;

  const { hour, minute } = secondsToTime(timeSeconds);

  // Try current day first
  const currentDayOfWeek = now.getDay();
  const todayDate = new Date(now);
  todayDate.setHours(hour, minute, 0, 0);

  // If today is a valid day and the time is in the future
  if (days.includes(currentDayOfWeek) && todayDate > now) {
    return todayDate;
  }

  // Find the next valid day
  for (let offset = 1; offset <= 7; offset++) {
    const targetDay = (currentDayOfWeek + offset) % 7;
    if (days.includes(targetDay)) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + offset);
      targetDate.setHours(hour, minute, 0, 0);
      return targetDate;
    }
  }

  return null;
}

/**
 * Configures notification settings for constraint alarms
 */
export async function configureNotifications(): Promise<void> {
  if (Platform.OS !== "android") return;

  // Configure notification handler to show visible alerts
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Request permissions
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    console.warn("[AlarmScheduler] Notification permissions not granted");
  }

  // Set up notification channel for time-based constraints (bedtime/focus)
  await Notifications.setNotificationChannelAsync("constraint_alarms", {
    name: "Screen Time Alerts",
    description: "Notifications for bedtime, focus time, and app limits",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    showBadge: true,
  });

  // Set up notification channel for app limit warnings
  await Notifications.setNotificationChannelAsync("app_limits", {
    name: "App Limit Alerts",
    description: "Notifications when app time limits are reached",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    showBadge: true,
  });
}

/**
 * Cancels all scheduled constraint alarms
 */
export async function cancelAllConstraintAlarms(): Promise<void> {
  const scheduledNotifications =
    await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of scheduledNotifications) {
    if (notification.identifier.startsWith(NOTIFICATION_ID_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(
        notification.identifier
      );
    }
  }

  // Remove the notification listener
  if (notificationListenerSubscription) {
    notificationListenerSubscription.remove();
    notificationListenerSubscription = null;
  }

  console.log("[AlarmScheduler] Cancelled all constraint alarms");
}

/**
 * Schedules alarms for bedtime and focus time rules
 */
export async function scheduleConstraintAlarms(
  timeRules: ChildTimeRule[],
  onAlarmTriggered: () => void
): Promise<void> {
  if (Platform.OS !== "android") {
    console.log("[AlarmScheduler] Not on Android, skipping alarm scheduling");
    return;
  }

  // Cancel existing alarms first
  await cancelAllConstraintAlarms();

  const now = new Date();
  let alarmsScheduled = 0;

  for (const rule of timeRules) {
    const days = rule.days ?? [];
    if (days.length === 0) continue;

    // Schedule alarm for rule START time
    const startDate = getNextOccurrence(rule.start_seconds, days, now);
    if (startDate) {
      const startId = `${NOTIFICATION_ID_PREFIX}${rule.id}_start`;
      const isBedtime = rule.rule_type === "bedtime";
      await Notifications.scheduleNotificationAsync({
        identifier: startId,
        content: {
          title: isBedtime ? "🌙 Bedtime Started" : "📚 Focus Time Started",
          body: isBedtime
            ? "Time to wind down! Apps are now restricted."
            : "Stay focused! Distracting apps are now blocked.",
          data: { ruleId: rule.id, type: "start", ruleType: rule.rule_type },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: startDate,
          channelId: "constraint_alarms",
        },
      });
      alarmsScheduled++;
      console.log(
        `[AlarmScheduler] Scheduled ${
          rule.rule_type
        } START at ${startDate.toISOString()}`
      );
    }

    // Schedule alarm for rule END time
    const endDate = getNextOccurrence(rule.end_seconds, days, now);
    if (endDate) {
      const endId = `${NOTIFICATION_ID_PREFIX}${rule.id}_end`;
      const isBedtime = rule.rule_type === "bedtime";
      await Notifications.scheduleNotificationAsync({
        identifier: endId,
        content: {
          title: isBedtime ? "☀️ Good Morning!" : "✅ Focus Time Ended",
          body: isBedtime
            ? "Bedtime is over. Apps are available again!"
            : "Great job staying focused! Apps are now available.",
          data: { ruleId: rule.id, type: "end", ruleType: rule.rule_type },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: endDate,
          channelId: "constraint_alarms",
        },
      });
      alarmsScheduled++;
      console.log(
        `[AlarmScheduler] Scheduled ${
          rule.rule_type
        } END at ${endDate.toISOString()}`
      );
    }
  }

  console.log(`[AlarmScheduler] Scheduled ${alarmsScheduled} alarms`);

  // Remove previous listener to avoid duplicate handlers
  if (notificationListenerSubscription) {
    notificationListenerSubscription.remove();
    notificationListenerSubscription = null;
  }

  // Set up listener for when notifications are received
  notificationListenerSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const data = notification.request.content.data;
      if (data?.ruleId) {
        console.log(
          `[AlarmScheduler] Alarm triggered: ${data.ruleType} ${data.type}`
        );
        onAlarmTriggered();
      }
    }
  );
}

/**
 * Reschedules alarms after constraints are updated
 */
export async function rescheduleAlarmsAfterUpdate(
  timeRules: ChildTimeRule[],
  onAlarmTriggered: () => void
): Promise<void> {
  console.log("[AlarmScheduler] Rescheduling alarms after constraint update");
  await scheduleConstraintAlarms(timeRules, onAlarmTriggered);
}

/**
 * Shows a notification when an app's time limit is reached
 */
export async function showAppLimitReachedNotification(
  appName: string,
  packageName: string
): Promise<void> {
  if (Platform.OS !== "android") return;

  // Avoid duplicate notifications for the same app on the same day
  const today = new Date().toISOString().split("T")[0];
  const notificationKey = `${APP_LIMIT_NOTIFICATION_ID}_${packageName}_${today}`;

  if (shownNotifications.has(notificationKey)) {
    console.log(
      `[AlarmScheduler] Already showed limit notification for ${appName} today`
    );
    return;
  }

  shownNotifications.add(notificationKey);

  await Notifications.scheduleNotificationAsync({
    identifier: `${APP_LIMIT_NOTIFICATION_ID}_${packageName}`,
    content: {
      title: "⏰ App Time Limit Reached",
      body: `You've used all your time for ${appName} today. Take a break!`,
      data: { type: "app_limit", packageName, appName },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId: "app_limits",
    },
  });

  console.log(`[AlarmScheduler] Showed app limit notification for ${appName}`);
}

/**
 * Shows a notification when the daily screen time limit is reached
 */
export async function showDailyLimitReachedNotification(
  limitMinutes: number
): Promise<void> {
  if (Platform.OS !== "android") return;

  // Avoid duplicate notifications for the same day
  const today = new Date().toISOString().split("T")[0];
  const notificationKey = `${DAILY_LIMIT_NOTIFICATION_ID}_${today}`;

  if (shownNotifications.has(notificationKey)) {
    console.log("[AlarmScheduler] Already showed daily limit notification today");
    return;
  }

  shownNotifications.add(notificationKey);

  const hours = Math.floor(limitMinutes / 60);
  const minutes = limitMinutes % 60;
  const timeText =
    hours > 0
      ? `${hours} hour${hours > 1 ? "s" : ""}${minutes > 0 ? ` ${minutes} min` : ""}`
      : `${minutes} minutes`;

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_LIMIT_NOTIFICATION_ID,
    content: {
      title: "📱 Daily Screen Time Limit Reached",
      body: `You've used your ${timeText} of screen time for today. Time to unplug!`,
      data: { type: "daily_limit", limitMinutes },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId: "app_limits",
    },
  });

  console.log("[AlarmScheduler] Showed daily limit notification");
}

/**
 * Shows a warning notification when approaching a time limit
 */
export async function showLimitWarningNotification(
  type: "app" | "daily",
  name: string,
  minutesRemaining: number
): Promise<void> {
  if (Platform.OS !== "android") return;

  // Only warn at 5 minutes remaining
  if (minutesRemaining !== 5) return;

  const today = new Date().toISOString().split("T")[0];
  const notificationKey = `warning_${type}_${name}_${today}`;

  if (shownNotifications.has(notificationKey)) {
    return;
  }

  shownNotifications.add(notificationKey);

  const title =
    type === "app" ? "⚠️ 5 Minutes Left" : "⚠️ 5 Minutes of Screen Time Left";
  const body =
    type === "app"
      ? `Only 5 minutes left for ${name} today.`
      : "You have 5 minutes of screen time remaining today.";

  await Notifications.scheduleNotificationAsync({
    identifier: `warning_${type}_${name}`,
    content: {
      title,
      body,
      data: { type: "warning", warningType: type, name, minutesRemaining },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId: "app_limits",
    },
  });

  console.log(`[AlarmScheduler] Showed ${type} warning notification for ${name}`);
}

/**
 * Clears the shown notifications tracking (call at midnight or day change)
 */
export function resetDailyNotificationTracking(): void {
  shownNotifications.clear();
  console.log("[AlarmScheduler] Reset daily notification tracking");
}
