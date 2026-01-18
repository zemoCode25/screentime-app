import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import {
  useAppLimit,
  useDeleteAppLimit,
  useSaveAppLimit,
} from "@/src/features/parent/hooks/use-app-limit";
import {
  appLimitSchema,
  DEFAULT_APP_LIMIT_VALUES,
  type AppLimitFormValues,
} from "@/src/features/parent/validation/app-limit-schema";

const buildZodResolver =
  <T extends z.ZodTypeAny>(schema: T) =>
  (values: unknown) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: Record<string, { type: string; message: string }> = {};

    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      if (!errors[path]) {
        errors[path] = { type: "validation", message: issue.message };
      }
    }

    return { values: {}, errors };
  };

const COLORS = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#DBEAFE",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
  error: "#DC2626",
  errorLight: "#FEF2F2",
};

const DAY_OPTIONS = [
  { key: "appliesSun", label: "Sun" },
  { key: "appliesMon", label: "Mon" },
  { key: "appliesTue", label: "Tue" },
  { key: "appliesWed", label: "Wed" },
  { key: "appliesThu", label: "Thu" },
  { key: "appliesFri", label: "Fri" },
  { key: "appliesSat", label: "Sat" },
] as const;

const splitSeconds = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return { hours: String(hours), minutes: String(minutes) };
};

export default function AppLimitFormScreen() {
  const router = useRouter();
  const { childId, packageName, appName } = useLocalSearchParams();
  const resolvedChildId = Array.isArray(childId) ? childId[0] : childId;
  const resolvedPackageName = Array.isArray(packageName)
    ? packageName[0]
    : packageName;
  const resolvedAppName = Array.isArray(appName) ? appName[0] : appName;

  const { data: existingLimit, isLoading: limitLoading } = useAppLimit(
    resolvedChildId,
    resolvedPackageName
  );

  const saveMutation = useSaveAppLimit();
  const deleteMutation = useDeleteAppLimit();

  const resolver = useMemo(() => buildZodResolver(appLimitSchema), []);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AppLimitFormValues>({
    defaultValues: DEFAULT_APP_LIMIT_VALUES,
    resolver,
    mode: "onTouched",
  });

  // Populate form when existing limit is loaded
  useEffect(() => {
    if (existingLimit) {
      const limitParts = splitSeconds(existingLimit.limit_seconds);
      const bonusParts = splitSeconds(existingLimit.bonus_seconds);

      reset({
        limitHours: limitParts.hours,
        limitMinutes: limitParts.minutes,
        appliesSun: existingLimit.applies_sun,
        appliesMon: existingLimit.applies_mon,
        appliesTue: existingLimit.applies_tue,
        appliesWed: existingLimit.applies_wed,
        appliesThu: existingLimit.applies_thu,
        appliesFri: existingLimit.applies_fri,
        appliesSat: existingLimit.applies_sat,
        bonusEnabled: existingLimit.bonus_enabled,
        bonusHours: bonusParts.hours,
        bonusMinutes: bonusParts.minutes,
        bonusStreakTarget: String(existingLimit.bonus_streak_target),
      });
    }
  }, [existingLimit, reset]);

  const isBusy =
    isSubmitting || saveMutation.isPending || deleteMutation.isPending;

  const handleSave = handleSubmit(async (values) => {
    if (!resolvedChildId || !resolvedPackageName) {
      return;
    }

    const limitSeconds =
      Number(values.limitHours) * 3600 + Number(values.limitMinutes) * 60;
    const bonusSeconds =
      Number(values.bonusHours) * 3600 + Number(values.bonusMinutes) * 60;

    await saveMutation.mutateAsync({
      childId: resolvedChildId,
      packageName: resolvedPackageName,
      limitSeconds,
      appliesSun: values.appliesSun,
      appliesMon: values.appliesMon,
      appliesTue: values.appliesTue,
      appliesWed: values.appliesWed,
      appliesThu: values.appliesThu,
      appliesFri: values.appliesFri,
      appliesSat: values.appliesSat,
      bonusEnabled: values.bonusEnabled,
      bonusSeconds,
      bonusStreakTarget: Number(values.bonusStreakTarget),
    });

    router.back();
  });

  const handleDelete = async () => {
    if (!resolvedChildId || !resolvedPackageName) {
      return;
    }

    await deleteMutation.mutateAsync({
      childId: resolvedChildId,
      packageName: resolvedPackageName,
    });

    router.back();
  };

  if (!resolvedChildId || !resolvedPackageName) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Invalid parameters</Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonLabel}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.backgroundGlow} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Set Daily Limit</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {resolvedAppName || resolvedPackageName}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {limitLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading existing limit...</Text>
          </View>
        ) : null}

        {saveMutation.error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={18} color={COLORS.error} />
            <Text style={styles.errorText}>{saveMutation.error.message}</Text>
          </View>
        ) : null}

        {/* Time Limit Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Time Limit</Text>
          <Text style={styles.sectionHint}>
            Maximum screen time allowed per day for this app.
          </Text>

          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>Hours</Text>
              <Controller
                control={control}
                name="limitHours"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                    style={[
                      styles.input,
                      errors.limitHours && styles.inputError,
                    ]}
                    keyboardType="number-pad"
                  />
                )}
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>Minutes</Text>
              <Controller
                control={control}
                name="limitMinutes"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                    style={[
                      styles.input,
                      errors.limitMinutes && styles.inputError,
                    ]}
                    keyboardType="number-pad"
                  />
                )}
              />
            </View>
          </View>
          {errors.limitMinutes?.message ? (
            <Text style={styles.fieldError}>{errors.limitMinutes.message}</Text>
          ) : null}
        </View>

        {/* Days Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Days</Text>
          <Text style={styles.sectionHint}>
            Select which days this limit applies.
          </Text>

          <View style={styles.daysRow}>
            {DAY_OPTIONS.map((day) => (
              <Controller
                key={day.key}
                control={control}
                name={day.key}
                render={({ field: { value, onChange } }) => (
                  <Pressable
                    onPress={() => onChange(!value)}
                    style={({ pressed }) => [
                      styles.dayChip,
                      value && styles.dayChipActive,
                      pressed && styles.dayChipPressed,
                    ]}
                  >
                    <Text
                      style={
                        value ? styles.dayChipTextActive : styles.dayChipText
                      }
                    >
                      {day.label}
                    </Text>
                  </Pressable>
                )}
              />
            ))}
          </View>
          {errors.appliesSun?.message ? (
            <Text style={styles.fieldError}>{errors.appliesSun.message}</Text>
          ) : null}
        </View>

        {/* Bonus Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Bonus Time</Text>
              <Text style={styles.sectionHint}>
                Reward extra time for good behavior.
              </Text>
            </View>
            <Controller
              control={control}
              name="bonusEnabled"
              render={({ field: { value, onChange } }) => (
                <Switch
                  value={value}
                  onValueChange={onChange}
                  trackColor={{ false: "#CBD5E1", true: COLORS.primaryLight }}
                  thumbColor={value ? COLORS.primary : "#F1F5F9"}
                />
              )}
            />
          </View>

          <Controller
            control={control}
            name="bonusEnabled"
            render={({ field: { value: bonusEnabled } }) =>
              bonusEnabled ? (
                <>
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.fieldLabel}>Bonus Hours</Text>
                      <Controller
                        control={control}
                        name="bonusHours"
                        render={({ field: { value, onChange, onBlur } }) => (
                          <TextInput
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            placeholder="0"
                            placeholderTextColor={COLORS.textSecondary}
                            style={styles.input}
                            keyboardType="number-pad"
                          />
                        )}
                      />
                    </View>
                    <View style={styles.timeField}>
                      <Text style={styles.fieldLabel}>Bonus Minutes</Text>
                      <Controller
                        control={control}
                        name="bonusMinutes"
                        render={({ field: { value, onChange, onBlur } }) => (
                          <TextInput
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            placeholder="30"
                            placeholderTextColor={COLORS.textSecondary}
                            style={styles.input}
                            keyboardType="number-pad"
                          />
                        )}
                      />
                    </View>
                  </View>

                  <View style={styles.streakField}>
                    <Text style={styles.fieldLabel}>
                      Streak target (days under limit)
                    </Text>
                    <Controller
                      control={control}
                      name="bonusStreakTarget"
                      render={({ field: { value, onChange, onBlur } }) => (
                        <TextInput
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholder="3"
                          placeholderTextColor={COLORS.textSecondary}
                          style={[styles.input, { width: 80 }]}
                          keyboardType="number-pad"
                        />
                      )}
                    />
                  </View>
                </>
              ) : (
                <></>
              )
            }
          />
        </View>

        {/* Actions */}
        <Pressable
          onPress={handleSave}
          disabled={isBusy}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitButtonPressed,
            isBusy && styles.submitButtonDisabled,
          ]}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color={COLORS.surface} />
          ) : (
            <Text style={styles.submitButtonText}>Save Limit</Text>
          )}
        </Pressable>

        {existingLimit ? (
          <Pressable
            onPress={handleDelete}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
              isBusy && styles.deleteButtonDisabled,
            ]}
          >
            {deleteMutation.isPending ? (
              <ActivityIndicator color={COLORS.error} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                <Text style={styles.deleteButtonText}>Remove Limit</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backgroundGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#E0F2FE",
    top: -100,
    right: -100,
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconButtonPressed: {
    backgroundColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 20,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.errorLight,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.error,
    fontFamily: "Inter_500Medium",
  },
  section: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  sectionHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: -4,
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  timeField: {
    flex: 1,
    gap: 6,
  },
  streakField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 16,
    color: COLORS.text,
    fontFamily: "Inter_500Medium",
  },
  inputError: {
    borderColor: COLORS.error,
  },
  fieldError: {
    fontSize: 12,
    color: COLORS.error,
    fontFamily: "Inter_500Medium",
  },
  daysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  dayChipPressed: {
    opacity: 0.8,
  },
  dayChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  dayChipTextActive: {
    fontSize: 13,
    color: COLORS.primaryDark,
    fontFamily: "Inter_700Bold",
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonPressed: {
    backgroundColor: COLORS.primaryDark,
  },
  submitButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.surface,
    fontFamily: "Inter_700Bold",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.errorLight,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  deleteButtonPressed: {
    opacity: 0.8,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.error,
    fontFamily: "Inter_600SemiBold",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  backButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.surface,
    fontFamily: "Inter_600SemiBold",
  },
});
