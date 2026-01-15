import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Not found" }} />
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.subtitle}>The link you followed is not available.</Text>
      <Link href="/(auth)/login" style={styles.link}>
        Go to sign in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  link: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
  },
});
