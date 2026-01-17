import { AppRegistry } from "react-native";

// Register the standalone BlockedAppScreen component BEFORE expo-router loads.
// This is launched by BlockingActivity as a separate React Native root,
// so it must not use expo-router navigation.
import BlockedAppScreen from "./src/features/child/components/BlockedAppScreen";
AppRegistry.registerComponent("BlockedAppScreen", () => BlockedAppScreen);

// Now import expo-router entry to boot the main app
import "expo-router/entry";
