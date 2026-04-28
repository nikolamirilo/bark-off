import { BorderRadius, Colors, Spacing } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Linking, StyleSheet, TouchableOpacity, View } from "react-native";

const CONTACT_EMAIL = "barkoffapp@gmail.com";
const CONTACT_INSTAGRAM =
  "https://www.instagram.com/barkoff.app?igsh=bjR6dThub3ExczU1";
const CONTACT_TIKTOK =
  "https://www.tiktok.com/@barkoff.app?_r=1&_t=ZS-95uV56dFMFY";

export function ContactUsCard() {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
        style={[styles.button, styles.email]}
        activeOpacity={0.8}
      >
        <Ionicons name="mail" size={18} color={Colors.textLight} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => Linking.openURL(CONTACT_INSTAGRAM)}
        style={[styles.button, styles.instagram]}
        activeOpacity={0.8}
      >
        <Ionicons name="logo-instagram" size={18} color={Colors.textLight} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => Linking.openURL(CONTACT_TIKTOK)}
        style={[styles.button, styles.tiktok]}
        activeOpacity={0.8}
      >
        <Ionicons name="logo-tiktok" size={18} color={Colors.textLight} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  email: { backgroundColor: Colors.primary },
  instagram: { backgroundColor: "#E1306C" },
  tiktok: { backgroundColor: "#000000" },
});
