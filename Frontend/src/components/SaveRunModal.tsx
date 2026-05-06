import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PALETTE } from '../constants/game';
import { ApiRunSummary } from '../services/api';
import { useRunMetaStore } from '../store/runMetaStore';
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

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(500)).current;

  // Set default name from mode + date
  useEffect(() => {
    if (visible) {
      const now = new Date();
      const dateStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      setName(`${mode === 'walk' ? 'Walk' : 'Run'} – ${dateStr}`);
      setDescription('');

      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 75, friction: 14, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, mode, backdropOpacity, slideAnim]);

  const dismiss = (save: boolean) => {
    if (save && runId && name.trim()) {
      saveMeta(runId, name.trim(), description.trim());
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
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.titleRow}>
            <View style={[styles.modeDot, { backgroundColor: accentColor }]} />
            <Text style={styles.title}>Save Activity?</Text>
          </View>

          {/* Stats summary */}
          <View style={styles.statsRow}>
            <StatChip
              icon="navigate-outline"
              value={formatDistance(distance)}
              label="Distance"
              color={accentColor}
            />
            <StatChip
              icon="time-outline"
              value={formatDuration(duration)}
              label="Duration"
              color={PALETTE.textMuted}
            />
            <StatChip
              icon="map-outline"
              value={String(tiles)}
              label="Tiles"
              color={PALETTE.textMuted}
            />
          </View>

          {/* Name input */}
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

          {/* Description input */}
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
            maxLength={200}
            returnKeyType="done"
          />

          {/* Buttons */}
          <Pressable
            style={[styles.saveBtn, { backgroundColor: accentColor }]}
            onPress={() => dismiss(true)}>
            <Ionicons name="checkmark" size={18} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.saveBtnLabel}>Save Activity</Text>
          </Pressable>

          <Pressable style={styles.discardBtn} onPress={() => dismiss(false)}>
            <Text style={styles.discardLabel}>Skip & Discard</Text>
          </Pressable>
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
  },
  sheet: {
    backgroundColor: 'rgba(10,10,10,0.99)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
    marginBottom: 20,
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
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },

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
  saveBtnLabel: { color: '#000', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  discardBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  discardLabel: { color: PALETTE.textDim, fontSize: 14, fontWeight: '500' },
});
