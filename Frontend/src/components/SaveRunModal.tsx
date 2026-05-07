import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Text } from './Text';

import { PALETTE } from '../constants/game';
import { ApiRunSummary, api } from '../services/api';
import { useRunMetaStore } from '../store/runMetaStore';
import { useRunStore } from '../store/runStore';
import { useUserStore } from '../store/userStore';
import { formatDistance, formatDuration } from '../utils/geo';

interface SaveRunModalProps {
  visible: boolean;
  summary: ApiRunSummary | null;
  runId: string | null;
  mode: 'walk' | 'run';
  onDone: () => void;
}

export function SaveRunModal({ visible, summary, runId, mode, onDone }: SaveRunModalProps) {
  const saveMeta = useRunMetaStore((s) => s.save);
  const path = useRunStore((s) => s.path);
  const user = useUserStore((s) => s.user);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [shareToFeed, setShareToFeed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const MAX_IMAGES = 5;

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      const now = new Date();
      const dateStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      setName(`${mode === 'walk' ? 'Walk' : 'Run'} – ${dateStr}`);
      setDescription('');
      setImages([]);
      setShareToFeed(false);
      setSharing(false);

      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 75, friction: 14, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, mode, backdropOpacity, slideAnim]);

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as ImagePicker.MediaType,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled) {
      const newUris = result.assets.filter((a) => a.base64).map((a) => `data:image/jpeg;base64,${a.base64!}`);
      if (newUris.length > 0) {
        setImages((prev) => [...prev, ...newUris].slice(0, MAX_IMAGES));
        setShareToFeed(true);
      }
    }
  };

  const capturePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images' as ImagePicker.MediaType,
      allowsEditing: true,
      aspect: [4, 3] as [number, number],
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setImages((prev) => [...prev, `data:image/jpeg;base64,${result.assets[0].base64!}`].slice(0, MAX_IMAGES));
      setShareToFeed(true);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const dismiss = async (save: boolean) => {
    if (save && runId && name.trim()) {
      saveMeta(runId, name.trim(), description.trim());

      if (shareToFeed && user) {
        setSharing(true);
        try {
          const simplePath = path
            .filter((_, i) => i % 4 === 0)
            .map((p) => ({ lat: p.lat, lng: p.lng }));
          const distM = summary?.distance ?? 0;
          const durMs = summary?.duration ?? 0;
          const pace = durMs > 0 && distM > 0 ? durMs / 1000 / (distM / 1000) : 0;

          await api.createPost({
            userId: user.id,
            username: user.username,
            userColor: user.color,
            runId,
            imageUris: images,
            description: description.trim(),
            distance: distM,
            duration: Math.round(durMs / 1000),
            pace,
            mode,
            path: simplePath,
          });
        } catch {
          // non-fatal
        } finally {
          setSharing(false);
        }
      }
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 500, duration: 220, useNativeDriver: true }),
    ]).start(onDone);
  };

  if (!visible) return null;

  const accentColor = mode === 'walk' ? PALETTE.walkPrimary : PALETTE.runPrimary;
  const distance = summary?.distance ?? 0;
  const duration = summary?.duration ?? 0;
  const tiles = summary?.capturedTiles?.length ?? 0;

  return (
    <>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />

      <KeyboardAvoidingView
        style={styles.kbWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}>

            {/* Header */}
            <View style={styles.titleRow}>
              <View style={[styles.modeDot, { backgroundColor: accentColor }]} />
              <Text style={styles.title}>Save Activity</Text>
            </View>

            {/* Stats chips */}
            <View style={styles.statsRow}>
              <StatChip icon="navigate-outline" value={formatDistance(distance)} label="Distance" color={accentColor} />
              <StatChip icon="time-outline" value={formatDuration(duration)} label="Duration" color={PALETTE.textMuted} />
              <StatChip icon="map-outline" value={String(tiles)} label="Tiles" color={PALETTE.textMuted} />
            </View>

            {/* Name */}
            <Text style={styles.fieldLabel}>ACTIVITY NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Give this run a name…"
              placeholderTextColor={PALETTE.textDim}
              selectionColor={accentColor}
              returnKeyType="next"
              maxLength={60}
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>NOTE (OPTIONAL)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="How did it feel?"
              placeholderTextColor={PALETTE.textDim}
              selectionColor={accentColor}
              multiline
              numberOfLines={3}
              maxLength={300}
              returnKeyType="done"
            />

            {/* Share divider */}
            <View style={styles.shareDivider}>
              <View style={styles.shareDividerLine} />
              <Text style={styles.shareDividerLabel}>SHARE TO FEED</Text>
              <View style={styles.shareDividerLine} />
            </View>

            {/* Share toggle row */}
            <View style={styles.shareToggleRow}>
              <View style={styles.shareToggleLeft}>
                <Ionicons name="newspaper-outline" size={18} color={PALETTE.textMuted} />
                <View>
                  <Text style={styles.shareToggleTitle}>Post to Feed</Text>
                  <Text style={styles.shareToggleSub}>Share with the community</Text>
                </View>
              </View>
              <Switch
                value={shareToFeed}
                onValueChange={setShareToFeed}
                trackColor={{ false: PALETTE.surface, true: accentColor + '80' }}
                thumbColor={shareToFeed ? accentColor : PALETTE.textDim}
              />
            </View>

            {/* Photo picker (only when sharing) */}
            {shareToFeed && (
              <View>
                <View style={styles.photoLabelRow}>
                  <Text style={styles.fieldLabel}>PHOTOS (OPTIONAL)</Text>
                  {images.length > 0 && (
                    <Text style={styles.photoCount}>{images.length}/{MAX_IMAGES}</Text>
                  )}
                </View>

                {/* Camera + Gallery buttons */}
                {images.length < MAX_IMAGES && (
                  <View style={styles.photoActions}>
                    <Pressable style={styles.photoActionBtn} onPress={capturePhoto}>
                      <Ionicons name="camera-outline" size={18} color={PALETTE.textDim} />
                      <Text style={styles.photoActionText}>Camera</Text>
                    </Pressable>
                    <Pressable style={styles.photoActionBtn} onPress={pickFromGallery}>
                      <Ionicons name="images-outline" size={18} color={PALETTE.textDim} />
                      <Text style={styles.photoActionText}>Gallery</Text>
                    </Pressable>
                  </View>
                )}

                {/* Thumbnails */}
                {images.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.thumbsScroll}
                    contentContainerStyle={styles.thumbsContent}>
                    {images.map((uri, i) => (
                      <View key={i} style={styles.thumbWrap}>
                        <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                        <Pressable
                          style={styles.thumbRemove}
                          onPress={() => removeImage(i)}
                          hitSlop={4}>
                          <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.9)" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Save button */}
            <Pressable
              style={[
                styles.saveBtn,
                { backgroundColor: accentColor },
                sharing && styles.saveBtnDisabled,
              ]}
              onPress={() => dismiss(true)}
              disabled={sharing}>
              <Ionicons
                name={sharing ? 'cloud-upload-outline' : shareToFeed ? 'share-social-outline' : 'checkmark-circle-outline'}
                size={18}
                color="#000"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.saveBtnLabel}>
                {sharing ? 'Sharing…' : shareToFeed ? 'Save & Share' : 'Save Activity'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.discardBtn}
              onPress={() => dismiss(false)}
              disabled={sharing}>
              <Text style={styles.discardLabel}>Skip & Discard</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}

function StatChip({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View style={chipStyles.wrap}>
      <Ionicons name={icon as never} size={14} color={color} style={{ marginBottom: 4 }} />
      <Text style={[chipStyles.value, { color }]}>{value}</Text>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingVertical: 12,
    gap: 1,
  },
  value: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { color: PALETTE.textDim, fontSize: 9, fontWeight: '600', letterSpacing: 0.8 },
});

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 50,
  },
  kbWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 51,
    maxHeight: '92%',
  },
  sheet: {
    backgroundColor: 'rgba(10,10,10,0.99)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    shadowColor: '#000',
    shadowOpacity: 0.9,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -16 },
    elevation: 30,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: PALETTE.border,
    alignSelf: 'center',
    marginTop: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  modeDot: { width: 8, height: 8, borderRadius: 4 },
  title: { color: PALETTE.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },

  fieldLabel: {
    color: PALETTE.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: PALETTE.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    color: PALETTE.text,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },

  // Share section
  shareDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  shareDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: PALETTE.border,
  },
  shareDividerLabel: {
    color: PALETTE.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },

  shareToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PALETTE.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  shareToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  shareToggleTitle: { color: PALETTE.text, fontSize: 15, fontWeight: '600' },
  shareToggleSub: { color: PALETTE.textDim, fontSize: 11, marginTop: 1 },

  // Photo section
  photoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  photoCount: {
    color: PALETTE.textDim,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: PALETTE.borderLight,
  },
  photoActionText: { color: PALETTE.textDim, fontSize: 13, fontWeight: '500' },

  thumbsScroll: { marginBottom: 14 },
  thumbsContent: { gap: 8, paddingRight: 4 },
  thumbWrap: {
    position: 'relative',
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: PALETTE.surface,
  },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
  },

  // Buttons
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    marginTop: 4,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  saveBtnDisabled: { opacity: 0.65 },
  saveBtnLabel: { color: '#000', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  discardBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  discardLabel: { color: PALETTE.textDim, fontSize: 14, fontWeight: '500' },
});
