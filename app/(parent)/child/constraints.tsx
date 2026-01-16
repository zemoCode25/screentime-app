import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import {
  useChildConstraints,
  useSaveChildConstraints,
} from "@/src/features/parent/hooks/use-child-constraints";
import {
  childConstraintsSchema,
  type ChildConstraintsFormValues,
} from "@/src/features/parent/validation/constraints-schema";

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
};

const DAY_OPTIONS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

const WEEKDAY_OPTIONS = DAY_OPTIONS.filter(
  (day) => day.value >= 1 && day.value <= 5
);

const DEFAULT_VALUES: ChildConstraintsFormValues = {
  bedtimes: [],
  focusTimes: [],
  dailyLimitHours: "0",
  dailyLimitMinutes: "0",
  weekendBonusHours: "0",
  weekendBonusMinutes: "0",
};

const parseTimeToSeconds = (value: string) => {
  const [hours, minutes] = value.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60;
};

const formatTimeFromSeconds = (seconds: number) => {
  const normalized = ((seconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
};

const splitDuration = (seconds: number) => {
  const safeSeconds = Math.max(seconds, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return { hours: String(hours), minutes: String(minutes) };
};

const toggleDay = (days: number[], day: number) => {
  if (days.includes(day)) {
    return days.filter((value) => value !== day);
  }
  return [...days, day].sort((a, b) => a - b);
};

const HOURS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0")
);

const MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0")
);

const parseTimeParts = (value?: string) => {
  if (!value) {
    return { hour: "00", minute: "00" };
  }
  const [rawHour, rawMinute] = value.split(":");
  const hour = HOURS.includes(rawHour) ? rawHour : "00";
  const minute = MINUTES.includes(rawMinute) ? rawMinute : "00";
  return { hour, minute };
};

const formatTimeParts = (hour: string, minute: string) =>
  `${hour}:${minute}`;

const buildZodResolver =
  <T extends z.ZodTypeAny>(schema: T) =>
  (values: unknown) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: Record<string, any> = {};

    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path : ["root"];
      let cursor: Record<string, any> = errors;

      path.forEach((segment, index) => {
        const isLast = index === path.length - 1;
        const key = String(segment);
        if (isLast) {
          cursor[key] = { type: "validation", message: issue.message };
          return;
        }
        if (!cursor[key]) {
          cursor[key] = typeof path[index + 1] === "number" ? [] : {};
        }
        cursor = cursor[key];
      });
    }

    return { values: {}, errors };
  };

type TimePickerState = {
  title: string;
  initialTime?: string;
  onConfirm: (time: string) => void;
};

type TimePickerModalProps = {
  visible: boolean;
  title: string;
  initialTime?: string;
  onCancel: () => void;
  onConfirm: (time: string) => void;
};

const TimePickerModal = ({
  visible,
  title,
  initialTime,
  onCancel,
  onConfirm,
}: TimePickerModalProps) => {
  const [selectedHour, setSelectedHour] = useState("00");
  const [selectedMinute, setSelectedMinute] = useState("00");

  useEffect(() => {
    if (!visible) {
      return;
    }
    const { hour, minute } = parseTimeParts(initialTime);
    setSelectedHour(hour);
    setSelectedMinute(minute);
  }, [visible, initialTime]);

  const handleConfirm = () => {
    onConfirm(formatTimeParts(selectedHour, selectedMinute));
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable
          style={styles.modalCard}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalPreview}>
            {formatTimeParts(selectedHour, selectedMinute)}
          </Text>
          <View style={styles.pickerRow}>
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Hour</Text>
              <ScrollView
                style={styles.pickerList}
                contentContainerStyle={styles.pickerListContent}
                showsVerticalScrollIndicator={false}
              >
                {HOURS.map((hour) => {
                  const isSelected = hour === selectedHour;
                  return (
                    <Pressable
                      key={hour}
                      onPress={() => setSelectedHour(hour)}
                      style={[
                        styles.pickerItem,
                        isSelected && styles.pickerItemActive,
                      ]}
                    >
                      <Text
                        style={
                          isSelected
                            ? styles.pickerItemTextActive
                            : styles.pickerItemText
                        }
                      >
                        {hour}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Minute</Text>
              <ScrollView
                style={styles.pickerList}
                contentContainerStyle={styles.pickerListContent}
                showsVerticalScrollIndicator={false}
              >
                {MINUTES.map((minute) => {
                  const isSelected = minute === selectedMinute;
                  return (
                    <Pressable
                      key={minute}
                      onPress={() => setSelectedMinute(minute)}
                      style={[
                        styles.pickerItem,
                        isSelected && styles.pickerItemActive,
                      ]}
                    >
                      <Text
                        style={
                          isSelected
                            ? styles.pickerItemTextActive
                            : styles.pickerItemText
                        }
                      >
                        {minute}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
          <View style={styles.modalActions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.modalButton,
                pressed && styles.modalButtonPressed,
              ]}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalButtonPrimary,
                pressed && styles.modalButtonPrimaryPressed,
              ]}
            >
              <Text style={styles.modalButtonTextPrimary}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

type TimePickerFieldProps = {
  label: string;
  value?: string;
  placeholder: string;
  error?: string;
  onPress: () => void;
};

const TimePickerField = ({
  label,
  value,
  placeholder,
  error,
  onPress,
}: TimePickerFieldProps) => (
  <View style={styles.timeField}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.input,
        styles.timePressable,
        pressed && styles.inputPressed,
        error && styles.inputError,
      ]}
    >
      <Text
        style={[
          styles.timeValue,
          !value && styles.timeValuePlaceholder,
        ]}
      >
        {value || placeholder}
      </Text>
    </Pressable>
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
  </View>
);

export default function ChildConstraintsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ childId?: string }>();
  const childId = Array.isArray(params.childId)
    ? params.childId[0]
    : params.childId;

  const constraintsQuery = useChildConstraints(childId);
  const saveMutation = useSaveChildConstraints(childId);

  const resolver = useMemo(
    () => buildZodResolver(childConstraintsSchema),
    []
  );

  const {
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ChildConstraintsFormValues>({
    defaultValues: DEFAULT_VALUES,
    resolver,
    mode: "onTouched",
  });

  const [timePickerState, setTimePickerState] =
    useState<TimePickerState | null>(null);

  const closeTimePicker = () => setTimePickerState(null);

  const handleTimeConfirm = (time: string) => {
    if (!timePickerState) {
      return;
    }
    timePickerState.onConfirm(time);
    closeTimePicker();
  };

  const {
    fields: bedtimeFields,
    append: appendBedtime,
    remove: removeBedtime,
  } = useFieldArray({
    control,
    name: "bedtimes",
  });

  const {
    fields: focusFields,
    append: appendFocus,
    remove: removeFocus,
  } = useFieldArray({
    control,
    name: "focusTimes",
  });

  const isBusy = isSubmitting || saveMutation.isPending;

  useEffect(() => {
    if (!constraintsQuery.data) {
      return;
    }

    const { bedtimes, focusTimes, usageSettings } = constraintsQuery.data;
    const dailyParts = splitDuration(
      usageSettings?.daily_limit_seconds ?? 0
    );
    const weekendParts = splitDuration(
      usageSettings?.weekend_bonus_seconds ?? 0
    );

    reset({
      bedtimes: bedtimes.map((rule) => ({
        days: rule.days ?? [],
        startTime: formatTimeFromSeconds(rule.start_seconds ?? 0),
        endTime: formatTimeFromSeconds(rule.end_seconds ?? 0),
      })),
      focusTimes: focusTimes.map((rule) => ({
        days: (rule.days ?? []).filter((day) => day >= 1 && day <= 5),
        startTime: formatTimeFromSeconds(rule.start_seconds ?? 0),
        endTime: formatTimeFromSeconds(rule.end_seconds ?? 0),
      })),
      dailyLimitHours: dailyParts.hours,
      dailyLimitMinutes: dailyParts.minutes,
      weekendBonusHours: weekendParts.hours,
      weekendBonusMinutes: weekendParts.minutes,
    });
  }, [constraintsQuery.data, reset]);

  const handleSave = handleSubmit(async (values) => {
    if (!childId) {
      setError("root", { message: "Missing child profile." });
      return;
    }

    clearErrors("root");

    try {
      const dailyLimitSeconds =
        Number(values.dailyLimitHours) * 3600 +
        Number(values.dailyLimitMinutes) * 60;
      const weekendBonusSeconds =
        Number(values.weekendBonusHours) * 3600 +
        Number(values.weekendBonusMinutes) * 60;

      await saveMutation.mutateAsync({
        bedtimes: values.bedtimes.map((entry) => ({
          days: entry.days,
          startSeconds: parseTimeToSeconds(entry.startTime),
          endSeconds: parseTimeToSeconds(entry.endTime),
        })),
        focusTimes: values.focusTimes.map((entry) => ({
          days: entry.days,
          startSeconds: parseTimeToSeconds(entry.startTime),
          endSeconds: parseTimeToSeconds(entry.endTime),
        })),
        dailyLimitSeconds,
        weekendBonusSeconds,
      });

      router.back();
    } catch (error) {
      setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "Unable to save constraints.",
      });
    }
  });

  if (!childId) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Child not found</Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
          <View>
            <Text style={styles.title}>Screen Time Rules</Text>
            <Text style={styles.subtitle}>
              Bedtime, focus, and daily limits
            </Text>
          </View>
        </View>

        {constraintsQuery.error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={18} color={COLORS.error} />
            <Text style={styles.errorText}>
              {constraintsQuery.error.message}
            </Text>
          </View>
        ) : null}

        {errors.root?.message ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={18} color={COLORS.error} />
            <Text style={styles.errorText}>{errors.root.message}</Text>
          </View>
        ) : null}

        {constraintsQuery.isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading constraints...</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Bedtime</Text>
            <Pressable
              onPress={() =>
                appendBedtime({
                  days: [],
                  startTime: "22:00",
                  endTime: "07:00",
                })
              }
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.addButtonPressed,
              ]}
            >
              <Ionicons name="add" size={16} color={COLORS.surface} />
              <Text style={styles.addButtonText}>Add bedtime</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>
            Block notifications and calls during bedtime. Ranges can cross
            midnight.
          </Text>

          {bedtimeFields.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="moon" size={24} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No bedtimes yet.</Text>
            </View>
          ) : null}

          {bedtimeFields.map((field, index) => {
            const dayError = errors.bedtimes?.[index]?.days?.message;
            const startError = errors.bedtimes?.[index]?.startTime?.message;
            const endError = errors.bedtimes?.[index]?.endTime?.message;

            return (
              <View key={field.id} style={styles.ruleCard}>
                <View style={styles.ruleHeaderRow}>
                  <Text style={styles.ruleTitle}>Bedtime #{index + 1}</Text>
                  <Pressable
                    onPress={() => removeBedtime(index)}
                    style={({ pressed }) => [
                      styles.iconButtonSmall,
                      pressed && styles.iconButtonPressed,
                    ]}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={COLORS.error}
                    />
                  </Pressable>
                </View>

                <Controller
                  control={control}
                  name={`bedtimes.${index}.days`}
                  render={({ field: { value, onChange } }) => (
                    <View>
                      <Text style={styles.fieldLabel}>Days</Text>
                      <View style={styles.dayRow}>
                        {DAY_OPTIONS.map((day) => {
                          const selected = (value ?? []).includes(day.value);
                          return (
                            <Pressable
                              key={day.value}
                              onPress={() =>
                                onChange(toggleDay(value ?? [], day.value))
                              }
                              style={({ pressed }) => [
                                styles.dayChip,
                                selected && styles.dayChipActive,
                                pressed && styles.dayChipPressed,
                              ]}
                            >
                              <Text
                                style={
                                  selected
                                    ? styles.dayChipTextActive
                                    : styles.dayChipText
                                }
                              >
                                {day.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {dayError ? (
                        <Text style={styles.fieldError}>{dayError}</Text>
                      ) : null}
                    </View>
                  )}
                />

                <View style={styles.timeRow}>
                  <Controller
                    control={control}
                    name={`bedtimes.${index}.startTime`}
                    render={({ field: { value, onChange } }) => (
                      <TimePickerField
                        label="Start"
                        value={value}
                        placeholder="22:00"
                        error={startError}
                        onPress={() =>
                          setTimePickerState({
                            title: "Bedtime start",
                            initialTime: value,
                            onConfirm: (time) => {
                              onChange(time);
                              clearErrors("root");
                            },
                          })
                        }
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`bedtimes.${index}.endTime`}
                    render={({ field: { value, onChange } }) => (
                      <TimePickerField
                        label="End"
                        value={value}
                        placeholder="07:00"
                        error={endError}
                        onPress={() =>
                          setTimePickerState({
                            title: "Bedtime end",
                            initialTime: value,
                            onConfirm: (time) => {
                              onChange(time);
                              clearErrors("root");
                            },
                          })
                        }
                      />
                    )}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Focus time</Text>
            <Pressable
              onPress={() =>
                appendFocus({
                  days: [1, 2, 3, 4, 5],
                  startTime: "16:00",
                  endTime: "18:00",
                })
              }
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.addButtonPressed,
              ]}
            >
              <Ionicons name="add" size={16} color={COLORS.surface} />
              <Text style={styles.addButtonText}>Add focus</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>
            Weekday-only ranges for distraction-free time.
          </Text>

          {focusFields.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="flash" size={24} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No focus ranges yet.</Text>
            </View>
          ) : null}

          {focusFields.map((field, index) => {
            const dayError = errors.focusTimes?.[index]?.days?.message;
            const startError = errors.focusTimes?.[index]?.startTime?.message;
            const endError = errors.focusTimes?.[index]?.endTime?.message;

            return (
              <View key={field.id} style={styles.ruleCard}>
                <View style={styles.ruleHeaderRow}>
                  <Text style={styles.ruleTitle}>Focus #{index + 1}</Text>
                  <Pressable
                    onPress={() => removeFocus(index)}
                    style={({ pressed }) => [
                      styles.iconButtonSmall,
                      pressed && styles.iconButtonPressed,
                    ]}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={COLORS.error}
                    />
                  </Pressable>
                </View>

                <Controller
                  control={control}
                  name={`focusTimes.${index}.days`}
                  render={({ field: { value, onChange } }) => (
                    <View>
                      <Text style={styles.fieldLabel}>Weekdays</Text>
                      <View style={styles.dayRow}>
                        {WEEKDAY_OPTIONS.map((day) => {
                          const selected = (value ?? []).includes(day.value);
                          return (
                            <Pressable
                              key={day.value}
                              onPress={() =>
                                onChange(toggleDay(value ?? [], day.value))
                              }
                              style={({ pressed }) => [
                                styles.dayChip,
                                selected && styles.dayChipActive,
                                pressed && styles.dayChipPressed,
                              ]}
                            >
                              <Text
                                style={
                                  selected
                                    ? styles.dayChipTextActive
                                    : styles.dayChipText
                                }
                              >
                                {day.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {dayError ? (
                        <Text style={styles.fieldError}>{dayError}</Text>
                      ) : null}
                    </View>
                  )}
                />

                <View style={styles.timeRow}>
                  <Controller
                    control={control}
                    name={`focusTimes.${index}.startTime`}
                    render={({ field: { value, onChange } }) => (
                      <TimePickerField
                        label="Start"
                        value={value}
                        placeholder="16:00"
                        error={startError}
                        onPress={() =>
                          setTimePickerState({
                            title: "Focus start",
                            initialTime: value,
                            onConfirm: (time) => {
                              onChange(time);
                              clearErrors("root");
                            },
                          })
                        }
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`focusTimes.${index}.endTime`}
                    render={({ field: { value, onChange } }) => (
                      <TimePickerField
                        label="End"
                        value={value}
                        placeholder="18:00"
                        error={endError}
                        onPress={() =>
                          setTimePickerState({
                            title: "Focus end",
                            initialTime: value,
                            onConfirm: (time) => {
                              onChange(time);
                              clearErrors("root");
                            },
                          })
                        }
                      />
                    )}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekend bonus</Text>
          <Text style={styles.sectionHint}>
            Extra bedtime minutes for weekends when daily usage is under the
            limit.
          </Text>
          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <Text style={styles.fieldLabel}>Hours</Text>
              <Controller
                control={control}
                name="weekendBonusHours"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    value={value}
                    onChangeText={(text) => {
                      onChange(text);
                      clearErrors("root");
                    }}
                    onBlur={onBlur}
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                    style={[
                      styles.input,
                      errors.weekendBonusHours && styles.inputError,
                    ]}
                    keyboardType="number-pad"
                  />
                )}
              />
              {errors.weekendBonusHours?.message ? (
                <Text style={styles.fieldError}>
                  {errors.weekendBonusHours.message}
                </Text>
              ) : null}
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.fieldLabel}>Minutes</Text>
              <Controller
                control={control}
                name="weekendBonusMinutes"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    value={value}
                    onChangeText={(text) => {
                      onChange(text);
                      clearErrors("root");
                    }}
                    onBlur={onBlur}
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                    style={[
                      styles.input,
                      errors.weekendBonusMinutes && styles.inputError,
                    ]}
                    keyboardType="number-pad"
                  />
                )}
              />
              {errors.weekendBonusMinutes?.message ? (
                <Text style={styles.fieldError}>
                  {errors.weekendBonusMinutes.message}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily limit (all apps)</Text>
          <Text style={styles.sectionHint}>
            Used to determine weekend bonus eligibility.
          </Text>
          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <Text style={styles.fieldLabel}>Hours</Text>
              <Controller
                control={control}
                name="dailyLimitHours"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    value={value}
                    onChangeText={(text) => {
                      onChange(text);
                      clearErrors("root");
                    }}
                    onBlur={onBlur}
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                    style={[
                      styles.input,
                      errors.dailyLimitHours && styles.inputError,
                    ]}
                    keyboardType="number-pad"
                  />
                )}
              />
              {errors.dailyLimitHours?.message ? (
                <Text style={styles.fieldError}>
                  {errors.dailyLimitHours.message}
                </Text>
              ) : null}
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.fieldLabel}>Minutes</Text>
              <Controller
                control={control}
                name="dailyLimitMinutes"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    value={value}
                    onChangeText={(text) => {
                      onChange(text);
                      clearErrors("root");
                    }}
                    onBlur={onBlur}
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                    style={[
                      styles.input,
                      errors.dailyLimitMinutes && styles.inputError,
                    ]}
                    keyboardType="number-pad"
                  />
                )}
              />
              {errors.dailyLimitMinutes?.message ? (
                <Text style={styles.fieldError}>
                  {errors.dailyLimitMinutes.message}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={isBusy}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitButtonPressed,
            isBusy && styles.submitButtonDisabled,
          ]}
        >
          {isBusy ? (
            <ActivityIndicator color={COLORS.surface} />
          ) : (
            <Text style={styles.submitButtonText}>Save rules</Text>
          )}
        </Pressable>
      </ScrollView>

      <TimePickerModal
        visible={Boolean(timePickerState)}
        title={timePickerState?.title ?? "Select time"}
        initialTime={timePickerState?.initialTime}
        onCancel={closeTimePicker}
        onConfirm={handleTimeConfirm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backgroundGlowTop: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#E0F2FE",
    top: -90,
    right: -100,
    opacity: 0.6,
  },
  backgroundGlowBottom: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#F0F9FF",
    bottom: -120,
    left: -120,
    opacity: 0.5,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    gap: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconButtonPressed: {
    backgroundColor: COLORS.primaryLight,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
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
    color: COLORS.error,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  sectionHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
  },
  addButtonPressed: {
    backgroundColor: COLORS.primaryDark,
  },
  addButtonText: {
    fontSize: 12,
    color: COLORS.surface,
    fontFamily: "Inter_600SemiBold",
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  ruleCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  ruleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ruleTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  dayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
  },
  dayChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayChipPressed: {
    opacity: 0.85,
  },
  dayChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  dayChipTextActive: {
    fontSize: 12,
    color: COLORS.surface,
    fontFamily: "Inter_600SemiBold",
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  timeField: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: "#F8FAFC",
    fontFamily: "Inter_400Regular",
  },
  inputPressed: {
    borderColor: COLORS.primary,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  timePressable: {
    justifyContent: "center",
  },
  timeValue: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: "Inter_400Regular",
  },
  timeValuePlaceholder: {
    color: COLORS.textSecondary,
  },
  fieldError: {
    fontSize: 12,
    color: COLORS.error,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  inlineRow: {
    flexDirection: "row",
    gap: 12,
  },
  inlineField: {
    flex: 1,
    gap: 6,
  },
  submitButton: {
    height: 52,
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
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  backButtonText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  modalPreview: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.primary,
    fontFamily: "Inter_700Bold",
  },
  pickerRow: {
    flexDirection: "row",
    gap: 16,
  },
  pickerColumn: {
    flex: 1,
    gap: 8,
  },
  pickerLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  pickerList: {
    maxHeight: 220,
  },
  pickerListContent: {
    gap: 6,
    paddingBottom: 8,
  },
  pickerItem: {
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  pickerItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  pickerItemText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  pickerItemTextActive: {
    fontSize: 14,
    color: COLORS.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtonPressed: {
    backgroundColor: COLORS.primaryLight,
  },
  modalButtonPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modalButtonPrimaryPressed: {
    backgroundColor: COLORS.primaryDark,
  },
  modalButtonText: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  modalButtonTextPrimary: {
    fontSize: 14,
    color: COLORS.surface,
    fontFamily: "Inter_600SemiBold",
  },
});
