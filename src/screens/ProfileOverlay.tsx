import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  Image,
  Linking,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import {
  UserProfile, saveProfile, getInitials,
  SocialPlatform, SocialProfile, PLATFORM_META, detectPlatform,
} from '../utils/profile';

const { width } = Dimensions.get('window');

// ── Platform icon ────────────────────────────────────────────────────────────

function PlatformIcon({ platform, size = 48 }: { platform: SocialPlatform; size?: number }) {
  const meta = PLATFORM_META[platform];
  const radius = size * 0.24;
  // Special font sizing for each symbol
  const fontSize = platform === 'youtube' ? size * 0.38 : platform === 'facebook' ? size * 0.52 : size * 0.38;
  return (
    <View style={[socialStyles.icon, { width: size, height: size, borderRadius: radius, backgroundColor: meta.bg }]}>
      <Text style={[socialStyles.iconText, { color: meta.textColor, fontSize }]}>{meta.symbol}</Text>
    </View>
  );
}

// ── Add Social Modal ─────────────────────────────────────────────────────────

function AddSocialModal({
  visible,
  existing,
  onAdd,
  onClose,
}: {
  visible: boolean;
  existing: SocialPlatform[];
  onAdd: (s: SocialProfile) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const detected = detectPlatform(url);
  const alreadyAdded = detected ? existing.includes(detected) : false;

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setUrl(text);
  };

  const handleAdd = () => {
    if (!detected) return;
    onAdd({ platform: detected, url: url.trim() });
    setUrl('');
    onClose();
  };

  const handleClose = () => {
    setUrl('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={socialStyles.modalBackdrop} activeOpacity={1} onPress={handleClose} />
        <View style={socialStyles.modalSheet}>
          <View style={socialStyles.modalHandle} />
          <Text style={socialStyles.modalTitle}>Add Social Profile</Text>
          <Text style={socialStyles.modalHint}>Paste a link to your TikTok, LinkedIn, YouTube, Facebook, or Instagram profile.</Text>

          <View style={socialStyles.urlRow}>
            <TextInput
              style={socialStyles.urlInput}
              value={url}
              onChangeText={setUrl}
              placeholder="https://www.instagram.com/yourname"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity style={socialStyles.pasteBtn} onPress={handlePaste}>
              <Text style={socialStyles.pasteBtnText}>Paste</Text>
            </TouchableOpacity>
          </View>

          {/* Detection preview */}
          {url.length > 0 && (
            <View style={socialStyles.detectionRow}>
              {detected && !alreadyAdded ? (
                <>
                  <PlatformIcon platform={detected} size={32} />
                  <Text style={socialStyles.detectedLabel}>{PLATFORM_META[detected].label} detected</Text>
                </>
              ) : detected && alreadyAdded ? (
                <Text style={socialStyles.detectionError}>{PLATFORM_META[detected].label} is already added</Text>
              ) : (
                <Text style={socialStyles.detectionError}>URL not recognised — must be TikTok, LinkedIn, YouTube, Facebook, or Instagram</Text>
              )}
            </View>
          )}

          <View style={socialStyles.modalBtns}>
            <TouchableOpacity style={socialStyles.cancelBtn} onPress={handleClose}>
              <Text style={socialStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[socialStyles.saveBtn, (!detected || alreadyAdded) && socialStyles.saveBtnDisabled]}
              onPress={handleAdd}
              disabled={!detected || alreadyAdded}
            >
              <Text style={socialStyles.saveBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  profile: UserProfile;
  onClose: () => void;
  onProfileChange: (profile: UserProfile) => void;
}

export default function ProfileOverlay({ visible, profile, onClose, onProfileChange }: Props) {
  const slideAnim = useRef(new Animated.Value(width)).current;
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [addSocialVisible, setAddSocialVisible] = useState(false);

  useEffect(() => {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
  }, [profile]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : width,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible]);

  const updateProfile = async (updated: UserProfile) => {
    onProfileChange(updated);
    await saveProfile(updated);
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      updateProfile({ ...profile, avatarUri: result.assets[0].uri });
    }
  };

  const handleSaveName = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) return;
    updateProfile({ ...profile, firstName: fn, lastName: ln });
    setEditingName(false);
  };

  const handleCancelName = () => {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setEditingName(false);
  };

  const handleAddSocial = (social: SocialProfile) => {
    const existing = profile.socialProfiles ?? [];
    updateProfile({ ...profile, socialProfiles: [...existing, social] });
  };

  const handleRemoveSocial = (platform: SocialPlatform) => {
    Alert.alert('Remove', `Remove your ${PLATFORM_META[platform].label} profile?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => updateProfile({
          ...profile,
          socialProfiles: (profile.socialProfiles ?? []).filter((s) => s.platform !== platform),
        }),
      },
    ]);
  };

  const socialProfiles = profile.socialProfiles ?? [];
  const existingPlatforms = socialProfiles.map((s) => s.platform);
  const allPlatformsAdded = existingPlatforms.length >= 5;
  const initials = getInitials(profile);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'right', 'bottom']}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Avatar */}
              <View style={styles.avatarSection}>
                <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8} style={styles.avatarWrapper}>
                  {profile.avatarUri ? (
                    <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarInitials}>
                      <Text style={styles.avatarInitialsText}>{initials}</Text>
                    </View>
                  )}
                  <View style={styles.avatarEditBadge}>
                    <Text style={styles.avatarEditBadgeText}>✎</Text>
                  </View>
                </TouchableOpacity>
                <Text style={styles.avatarHint}>Tap to change photo</Text>
              </View>

              {/* Name */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Name</Text>
                {editingName ? (
                  <View style={styles.nameEditBox}>
                    <TextInput
                      style={styles.nameInput}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="First name"
                      placeholderTextColor="#555"
                      autoFocus
                      returnKeyType="next"
                    />
                    <TextInput
                      style={styles.nameInput}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Last name"
                      placeholderTextColor="#555"
                      returnKeyType="done"
                      onSubmitEditing={handleSaveName}
                    />
                    <View style={styles.nameEditBtns}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelName}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName}>
                        <Text style={styles.saveBtnText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fieldRow} onPress={() => setEditingName(true)} activeOpacity={0.7}>
                    <Text style={styles.fieldValue}>{profile.firstName} {profile.lastName}</Text>
                    <Text style={styles.fieldEdit}>✎</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Email */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Email</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldValue}>{profile.email}</Text>
                </View>
              </View>

              {/* Plan */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Plan</Text>
                <View style={styles.fieldRow}>
                  <View style={[styles.planBadge, profile.plan === 'Pro' && styles.planBadgePro]}>
                    <Text style={[styles.planBadgeText, profile.plan === 'Pro' && styles.planBadgeTextPro]}>
                      {profile.plan === 'Pro' ? '⭐ Pro' : '✦ Free'}
                    </Text>
                  </View>
                  {profile.plan === 'Free' && (
                    <TouchableOpacity style={styles.upgradeBtn}>
                      <Text style={styles.upgradeBtnText}>Upgrade →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Social Profiles */}
              <View style={styles.section}>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>Social Profiles</Text>
                  {!allPlatformsAdded && (
                    <TouchableOpacity style={socialStyles.addBtn} onPress={() => setAddSocialVisible(true)}>
                      <Text style={socialStyles.addBtnText}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {socialProfiles.length === 0 ? (
                  <Text style={socialStyles.emptyHint}>Add your social profiles to share them</Text>
                ) : (
                  <View style={socialStyles.iconsRow}>
                    {socialProfiles.map((s) => (
                      <TouchableOpacity
                        key={s.platform}
                        onPress={() => Linking.openURL(s.url)}
                        onLongPress={() => handleRemoveSocial(s.platform)}
                        activeOpacity={0.75}
                        style={socialStyles.iconWrapper}
                      >
                        <PlatformIcon platform={s.platform} size={48} />
                        <Text style={socialStyles.iconLabel}>{PLATFORM_META[s.platform].label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {socialProfiles.length > 0 && (
                  <Text style={socialStyles.removeHint}>Hold to remove</Text>
                )}
                <View style={{ height: 16 }} />
              </View>

            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Made by Kapwing{'  ·  '}
                <Text style={styles.footerLink} onPress={() => Linking.openURL('https://www.kapwing.com')}>
                  About
                </Text>
              </Text>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Animated.View>

      <AddSocialModal
        visible={addSocialVisible}
        existing={existingPlatforms}
        onAdd={handleAddSocial}
        onClose={() => setAddSocialVisible(false)}
      />
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const socialStyles = StyleSheet.create({
  addBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 18, lineHeight: 22, fontWeight: '400' },
  emptyHint: { color: '#555', fontSize: 14, paddingBottom: 4 },
  iconsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 4 },
  iconWrapper: { alignItems: 'center', gap: 5 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  iconText: { fontWeight: '800', letterSpacing: -0.5 },
  iconLabel: { color: '#666', fontSize: 11 },
  removeHint: { color: '#444', fontSize: 11, marginTop: 8 },
  // Add social modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  modalHint: { color: '#666', fontSize: 13, lineHeight: 18, marginBottom: 20 },
  urlRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  urlInput: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  pasteBtn: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  pasteBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  detectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  detectedLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  detectionError: { color: '#888', fontSize: 13 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#2a2a2a', alignItems: 'center',
  },
  cancelBtnText: { color: '#888', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#FF3B30', alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: width * 0.88,
    backgroundColor: '#0f0f0f',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  scroll: { paddingBottom: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#888', fontSize: 15 },
  avatarSection: {
    alignItems: 'center', paddingVertical: 32,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  avatarWrapper: { position: 'relative', marginBottom: 10 },
  avatarInitials: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitialsText: { color: '#fff', fontSize: 36, fontWeight: '700', letterSpacing: 1 },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2a2a2a', borderWidth: 2, borderColor: '#0f0f0f',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEditBadgeText: { color: '#fff', fontSize: 13 },
  avatarHint: { color: '#555', fontSize: 13 },
  section: {
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 4,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  sectionLabel: {
    color: '#666', fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingBottom: 16,
  },
  fieldValue: { color: '#fff', fontSize: 16, flex: 1 },
  fieldEdit: { color: '#555', fontSize: 18, paddingLeft: 12 },
  nameEditBox: { gap: 10, paddingBottom: 16 },
  nameInput: {
    backgroundColor: '#1e1e1e', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#333',
  },
  nameEditBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#1e1e1e', alignItems: 'center',
  },
  cancelBtnText: { color: '#888', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#FF3B30', alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  planBadge: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#333',
  },
  planBadgePro: { backgroundColor: 'rgba(255,59,48,0.15)', borderColor: '#FF3B30' },
  planBadgeText: { color: '#888', fontSize: 14, fontWeight: '600' },
  planBadgeTextPro: { color: '#FF3B30' },
  upgradeBtn: { marginLeft: 12 },
  upgradeBtnText: { color: '#FF3B30', fontSize: 14, fontWeight: '600' },
  footer: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
  },
  footerText: { color: '#555', fontSize: 13, textAlign: 'center' },
  footerLink: { color: '#888', textDecorationLine: 'underline' },
});
