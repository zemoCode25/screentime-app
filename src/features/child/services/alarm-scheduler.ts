import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { Database } from "@/types/database-types";

type ChildTimeRule = Database["public"]["Tables"]["child_time_rules"]["Row"];

// Notification IDs for constraint alarms
const NOTIFICATION_ID_PREFIX = "constraint_alarm_";

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

  // Configure notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false, // Silent - just trigger the callback
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    }),
  });

  // Request permissions
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    console.warn("[AlarmScheduler] Notification permissions not granted");
  }

  // Set up notification channel for Android
  await Notifications.setNotificationChannelAsync("constraint_alarms", {
    name: "Constraint Alarms",
    importance: Notifications.AndroidImportance.HIGH,
    sound: null, // Silent
    vibrationPattern: null,
    enableVibrate: false,
    showBadge: false,
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
      await Notifications.scheduleNotificationAsync({
        identifier: startId,
        content: {
          title: "Constraint Alert",
          body: `${rule.rule_type} starting`,
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
      await Notifications.scheduleNotificationAsync({
        identifier: endId,
        content: {
          title: "Constraint Alert",
          body: `${rule.rule_type} ending`,
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

  // Set up listener for when notifications are received
  Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data;
    if (data?.ruleId) {
      console.log(
        `[AlarmScheduler] Alarm triggered: ${data.ruleType} ${data.type}`
      );
      onAlarmTriggered();
    }
  });
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
