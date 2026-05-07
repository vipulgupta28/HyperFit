import { StyleSheet, View } from 'react-native';
import { Text } from './Text';

import { PALETTE } from '../constants/game';

interface StatPillProps {
  label: string;
  value: string;
  accent?: string;
}

export function StatPill({ label, value, accent = PALETTE.highlight }: StatPillProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.surface,
    borderColor: PALETTE.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 5,
  },
  label: {
    color: PALETTE.textMuted,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '600',
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
