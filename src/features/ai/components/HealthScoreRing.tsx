import { StyleSheet, Text, View } from "react-native";

const COLORS = {
  excellent: "#10B981", // Green
  good: "#22C55E",
  moderate: "#F59E0B", // Amber
  poor: "#EF4444", // Red
  background: "#E2E8F0",
  text: "#0F172A",
  textSecondary: "#64748B",
};

interface HealthScoreRingProps {
  score: number; // 0-100
  size?: number;
  showLabel?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return COLORS.excellent;
  if (score >= 60) return COLORS.good;
  if (score >= 40) return COLORS.moderate;
  return COLORS.poor;
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Moderate";
  return "Needs Attention";
}

export function HealthScoreRing({
  score,
  size = 100,
  showLabel = true,
}: HealthScoreRingProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const borderWidth = size * 0.08;
  const innerSize = size - borderWidth * 2;

  return (
    <View
      style={[
        styles.outerRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: color,
        },
      ]}
    >
      <View
        style={[
          styles.innerCircle,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: `${color}10`,
          },
        ]}
      >
        <Text style={[styles.scoreText, { color, fontSize: size * 0.28 }]}>
          {Math.round(score)}
        </Text>
        {showLabel && (
          <Text style={[styles.labelText, { fontSize: size * 0.1 }]}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerRing: {
    alignItems: "center",
    justifyContent: "center",
  },
  innerCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  labelText: {
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
});
