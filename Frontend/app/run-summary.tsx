import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StatPill } from '@/src/components/StatPill';
import { PALETTE } from '@/src/constants/game';
import { useRunStore } from '@/src/store/runStore';
import { useUserStore } from '@/src/store/userStore';
import { formatDistance, formatDuration } from '@/src/utils/geo';

export default function RunSummary() {
  const summary = useRunStore((s) => s.lastSummary);
  const user = useUserStore((s) => s.user);
  const router = useRouter();

  if (!summary) {
    return (
      <View style={[styles.container, styles.empty]}>
        <Text style={styles.title}>No run yet</Text>
        <Text style={styles.muted}>Run a route, then come back here.</Text>
        <Pressable style={styles.cta} onPress={() => router.back()}>
          <Text style={styles.ctaText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const minPerKm = summary.pace > 0 ? summary.pace.toFixed(2) : '—';
  const newTiles = summary.capturedTiles.filter(
    (t) => t.ownerId === summary.userId,
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>RUN COMPLETE</Text>
      <Text style={styles.title}>
        {summary.netTerritoryDelta > 0
          ? `+${summary.netTerritoryDelta} new tiles`
          : summary.netTerritoryDelta < 0
            ? `${summary.netTerritoryDelta} tiles lost`
            : 'Strength reinforced'}
      </Text>

      <View style={styles.row}>
        <StatPill label="Distance" value={formatDistance(summary.distance)} accent={PALETTE.highlight} />
        <StatPill label="Time" value={formatDuration(summary.duration)} accent={PALETTE.textMuted} />
      </View>
      <View style={styles.row}>
        <StatPill label="Pace" value={`${minPerKm} min/km`} accent={PALETTE.highlight} />
        <StatPill
          label="Calories"
          value={`${summary.caloriesEstimate} kcal`}
          accent={PALETTE.textMuted}
        />
      </View>

      <Text style={styles.sectionTitle}>Tiles touched ({summary.capturedTiles.length})</Text>
      <Text style={styles.muted}>
        {newTiles.length} now owned by you · {summary.capturedTiles.length - newTiles.length} reinforced or contested
      </Text>

      <View style={styles.tilesGrid}>
        {summary.capturedTiles.slice(0, 24).map((t) => (
          <View
            key={t.h3Index}
            style={[
              styles.tileChip,
              {
                backgroundColor: t.ownerColor ?? PALETTE.border,
                borderColor:
                  t.ownerId === summary.userId ? PALETTE.borderLight : PALETTE.border,
              },
            ]}
          />
        ))}
      </View>

      <Pressable style={styles.cta} onPress={() => router.back()}>
        <Text style={styles.ctaText}>
          {user ? `Back to map, ${user.username}` : 'Back to map'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 14,
    backgroundColor: PALETTE.background,
    flexGrow: 1,
  },
  empty: { alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    color: PALETTE.textMuted,
    letterSpacing: 3,
    fontWeight: '600',
    fontSize: 11,
    marginBottom: 4,
  },
  title: {
    color: PALETTE.text,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  row: { flexDirection: 'row', gap: 10 },
  sectionTitle: {
    color: PALETTE.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  muted: { color: PALETTE.textMuted, fontSize: 14, lineHeight: 21 },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tileChip: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cta: {
    marginTop: 'auto',
    backgroundColor: PALETTE.text,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
  },
  ctaText: { color: PALETTE.onLight, fontWeight: '600', fontSize: 14, letterSpacing: 2 },
});
