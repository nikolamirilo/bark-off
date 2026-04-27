import {
  Colors,
  DogText,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import { useDogProfile } from "@/store/appStore";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface HomeHeaderProps {
  onProfilePress: () => void;
}

export function HomeHeader({ onProfilePress }: HomeHeaderProps) {
  const dogProfile = useDogProfile();
  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.greeting}>
          Hi, {dogProfile.name || "Friend"}!{" "}
        </Text>
        <Text style={styles.tagline}>{DogText.tagline}</Text>
      </View>
      <TouchableOpacity onPress={onProfilePress} style={styles.profileButton}>
        {dogProfile.avatarUri ? (
          <Image
            source={{ uri: dogProfile.avatarUri }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Image
              source={require("../../assets/images/pet_default.png")}
              style={styles.avatar}
              resizeMode="cover"
            />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  textContainer: { flex: 1 },
  greeting: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  profileButton: {
    width: 70,
    height: 70,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: Colors.backgroundLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: { width: "100%", height: "100%", borderRadius: 25 },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 25,
    backgroundColor: "#EEE",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
