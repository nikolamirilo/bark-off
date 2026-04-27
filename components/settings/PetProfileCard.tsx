import { Card } from "@/components/ui/Card";
import {
  BorderRadius,
  Colors,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import { useAppStore } from "@/store/appStore";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export function PetProfileCard() {
  const { dogProfile, setDogProfile } = useAppStore();
  const [dogName, setDogName] = useState(dogProfile.name);

  // Debounced save of the pet's name.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (dogName !== dogProfile.name) {
        setDogProfile({ ...dogProfile, name: dogName });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [dogName, dogProfile, setDogProfile]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: false,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      setDogProfile({ ...dogProfile, avatarUri: result.assets[0].uri });
    }
  };

  return (
    <Card emoji="🐾" title="Your Pet" style={styles.card}>
      <View style={styles.row}>
        <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
          {dogProfile.avatarUri ? (
            <Image
              source={{ uri: dogProfile.avatarUri }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>🐶</Text>
            </View>
          )}
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>✎</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.nameInputContainer}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.textInput}
            value={dogName}
            onChangeText={setDogName}
            placeholder="Enter your pet's name"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </View>
      <Text style={styles.hint}>Tap image to change</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  avatarWrapper: { position: "relative" },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlaceholderText: { fontSize: 24 },
  editBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: Colors.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  editBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "bold" },
  nameInputContainer: { flex: 1, gap: Spacing.xs },
  label: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  hint: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginLeft: 74,
    marginTop: Spacing.xs,
  },
});
