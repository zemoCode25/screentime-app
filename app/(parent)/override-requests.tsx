import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/features/auth/hooks/use-auth";
import {
  useDenyOverride,
  useGrantOverride,
  usePendingOverrideRequests,
} from "@/src/features/parent/hooks/use-override-requests";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${month} ${day}, ${hours}:${minutes} ${ampm}`;
};

const DURATION_OPTIONS = [
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "Until end of day", minutes: "eod" as const },
  { label: "Custom", minutes: "custom" as const },
];

export default function OverrideRequestsScreen() {
  const { session } = useAuth();
  const user = session?.user;
  const { data: requests, isLoading } = usePendingOverrideRequests(user?.id);
  const grantOverride = useGrantOverride();
  const denyOverride = useDenyOverride();

  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<
    number | "eod" | "custom"
  >(30);
  const [customMinutes, setCustomMinutes] = useState("");
  const [grantNote, setGrantNote] = useState("");

  const handleGrantPress = (requestId: string) => {
    setSelectedRequest(requestId);
    setSelectedDuration(30);
    setCustomMinutes("");
    setGrantNote("");
    setShowGrantModal(true);
  };

  const handleConfirmGrant = async () => {
    if (!selectedRequest || !user) return;

    let durationMinutes: number;

    if (selectedDuration === "custom") {
      const parsed = parseInt(customMinutes, 10);
      if (isNaN(parsed) || parsed <= 0) {
        Alert.alert(
          "Invalid Duration",
          "Please enter a valid number of minutes"
        );
        return;
      }
      durationMinutes = parsed;
    } else if (selectedDuration === "eod") {
      // Calculate minutes until end of day
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      durationMinutes = Math.ceil((endOfDay.getTime() - now.getTime()) / 60000);
    } else {
      durationMinutes = selectedDuration;
    }

    try {
      await grantOverride.mutateAsync({
        requestId: selectedRequest,
        parentUserId: user.id,
        durationMinutes,
        note: grantNote || undefined,
      });
      setShowGrantModal(false);
      Alert.alert("Success", "Override granted successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to grant override. Please try again.");
    }
  };

  const handleDeny = async (requestId: string) => {
    if (!user) return;

    Alert.alert("Deny Request", "Are you sure you want to deny this request?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deny",
        style: "destructive",
        onPress: async () => {
          try {
            await denyOverride.mutateAsync({
              requestId,
              parentUserId: user.id,
            });
            Alert.alert("Success", "Request denied");
          } catch (error) {
            Alert.alert("Error", "Failed to deny request");
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Override Requests</Text>
        <Text style={styles.headerSubtitle}>
          {requests?.length ?? 0} pending{" "}
          {requests?.length === 1 ? "request" : "requests"}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {!requests || requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No Pending Requests</Text>
            <Text style={styles.emptyText}>
              You'll see override requests from your children here
            </Text>
          </View>
        ) : (
          <View style={styles.requestList}>
            {requests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.appIcon}>
                    <Ionicons name="apps" size={24} color="#3b82f6" />
                  </View>
                  <View style={styles.requestInfo}>
                    <Text style={styles.appName}>{request.app_name}</Text>
                    <Text style={styles.childName}>{request.child_name}</Text>
                  </View>
                </View>

                <View style={styles.requestDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color="#64748b" />
                    <Text style={styles.detailText}>
                      {formatDate(request.requested_at)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="cube-outline" size={16} color="#64748b" />
                    <Text style={styles.detailTextSmall}>
                      {request.package_name}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.grantButton]}
                    onPress={() => handleGrantPress(request.id)}
                    disabled={grantOverride.isPending}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Grant</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.denyButton]}
                    onPress={() => handleDeny(request.id)}
                    disabled={denyOverride.isPending}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Deny</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showGrantModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGrantModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Grant Override</Text>
              <Pressable onPress={() => setShowGrantModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>Select duration:</Text>

            <View style={styles.durationOptions}>
              {DURATION_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.durationOption,
                    selectedDuration === option.minutes &&
                      styles.durationOptionSelected,
                  ]}
                  onPress={() => setSelectedDuration(option.minutes)}
                >
                  <Text
                    style={[
                      styles.durationOptionText,
                      selectedDuration === option.minutes &&
                        styles.durationOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedDuration === "custom" && (
              <View style={styles.customInputContainer}>
                <Text style={styles.inputLabel}>Minutes:</Text>
                <TextInput
                  style={styles.customInput}
                  value={customMinutes}
                  onChangeText={setCustomMinutes}
                  keyboardType="number-pad"
                  placeholder="Enter minutes"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            )}

            <View style={styles.noteContainer}>
              <Text style={styles.inputLabel}>Note (optional):</Text>
              <TextInput
                style={styles.noteInput}
                value={grantNote}
                onChangeText={setGrantNote}
                placeholder="E.g., For homework"
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowGrantModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleConfirmGrant}
                disabled={grantOverride.isPending}
              >
                {grantOverride.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>
                    Grant Access
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  requestList: {
    padding: 16,
    gap: 12,
  },
  requestCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  requestInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  childName: {
    fontSize: 14,
    color: "#64748b",
  },
  requestDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: "#64748b",
  },
  detailTextSmall: {
    fontSize: 12,
    color: "#94a3b8",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  grantButton: {
    backgroundColor: "#10b981",
  },
  denyButton: {
    backgroundColor: "#ef4444",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e293b",
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 12,
  },
  durationOptions: {
    gap: 8,
    marginBottom: 16,
  },
  durationOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  durationOptionSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  durationOptionText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  durationOptionTextSelected: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  customInputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
  },
  customInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#1e293b",
  },
  noteContainer: {
    marginBottom: 20,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#1e293b",
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: "#e2e8f0",
  },
  modalConfirmButton: {
    backgroundColor: "#3b82f6",
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
