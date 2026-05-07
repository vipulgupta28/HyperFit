import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/src/components/Text';

import { PALETTE } from '@/src/constants/game';
import { ApiRun, api } from '@/src/services/api';
import { useRunMetaStore } from '@/src/store/runMetaStore';
import { useRunsStore } from '@/src/store/runsStore';
import { useUserStore } from '@/src/store/userStore';
import { formatDistance, formatDuration } from '@/src/utils/geo';

// ── Level system ─────────────────────────────────────────────────────────

interface Level {
  name: string;
  icon: string; // Ionicons name
  minTiles: number;
  color: string;
}

const LEVELS: Level[] = [
  { name: 'Scout',       icon: 'telescope-outline',   minTiles: 0,    color: '#6B7280' },
  { name: 'Explorer',    icon: 'map-outline',          minTiles: 10,   color: '#3B82F6' },
  { name: 'Pathfinder',  icon: 'compass-outline',      minTiles: 50,   color: '#8B5CF6' },
  { name: 'Trailblazer', icon: 'flame-outline',        minTiles: 200,  color: '#F59E0B' },
  { name: 'Conqueror',   icon: 'shield-outline',       minTiles: 500,  color: '#EF4444' },
  { name: 'Master',      icon: 'star-outline',         minTiles: 1000, color: '#F97316' },
];

function getLevel(tiles: number): Level & { next: Level | null; progress: number } {
  let current = LEVELS[0];
  let next: Level | null = LEVELS[1];
  for (let i = 0; i < LEVELS.length; i++) {
    if (tiles >= LEVELS[i].minTiles) {
      current = LEVELS[i];
      next = LEVELS[i + 1] ?? null;
    }
  }
  const progress = next
    ? (tiles - current.minTiles) / (next.minTiles - current.minTiles)
    : 1;
  return { ...current, next, progress: Math.min(1, Math.max(0, progress)) };
}

// ── Components ───────────────────────────────────────────────────────────

function LevelBadge({ tiles }: { tiles: number }) {
  const level = getLevel(tiles);
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: level.progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [level.progress, barAnim]);

  return (
    <View style={levelStyles.wrap}>
      <View style={levelStyles.header}>
        <View style={[levelStyles.iconWrap, { borderColor: level.color + '40' }]}>
          <Ionicons name={level.icon as never} size={20} color={level.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[levelStyles.name, { color: level.color }]}>{level.name}</Text>
          {level.next ? (
            <Text style={levelStyles.nextLabel}>
              {level.next.minTiles - tiles} tiles to {level.next.name}
            </Text>
          ) : (
            <Text style={levelStyles.nextLabel}>Max level reached</Text>
          )}
        </View>
        <Text style={[levelStyles.tileCount, { color: level.color }]}>{tiles}</Text>
      </View>
      <View style={levelStyles.barTrack}>
        <Animated.View
          style={[
            levelStyles.barFill,
            {
              backgroundColor: level.color,
              width: barAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const levelStyles = StyleSheet.create({
  wrap: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  nextLabel: { color: PALETTE.textDim, fontSize: 12, marginTop: 2 },
  tileCount: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: PALETTE.surfaceElevated,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2 },
});

function RunCard({ run, onPress }: { run: ApiRun; onPress: () => void }) {
  const isRun = run.mode === 'run';
  const meta = useRunMetaStore((s) => s.get(run.id));
  const modeColor = isRun ? PALETTE.runPrimary : PALETTE.walkPrimary;

  return (
    <Pressable style={runCardStyles.card} onPress={onPress}>
      <View style={runCardStyles.left}>
        <Text style={runCardStyles.name} numberOfLines={1}>
          {meta?.name ?? (isRun ? 'Run' : 'Walk')}
        </Text>
        <Text style={runCardStyles.distance}>{formatDistance(run.distance)}</Text>
        <View style={runCardStyles.meta}>
          <Text style={runCardStyles.metaText}>{formatDuration(run.duration)}</Text>
          <Text style={runCardStyles.dot}>·</Text>
          <Text style={runCardStyles.metaText}>{run.capturedTileIds.length} tiles</Text>
          {run.mode && (
            <>
              <Text style={runCardStyles.dot}>·</Text>
              <View style={[runCardStyles.modeChip, isRun && runCardStyles.runChip]}>
                <Ionicons name={isRun ? 'flash' : 'walk'} size={10} color={modeColor} />
                <Text style={[runCardStyles.modeTag, isRun && runCardStyles.runTag]}>
                  {run.mode}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
      <View style={runCardStyles.right}>
        <Text style={runCardStyles.date}>
          {new Date(run.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={PALETTE.textDim} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}

const runCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: PALETTE.surfaceCard,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  left: { gap: 3, flex: 1 },
  right: { alignItems: 'flex-end', gap: 2 },
  name: { color: PALETTE.text, fontWeight: '600', fontSize: 14 },
  distance: { color: PALETTE.text, fontWeight: '700', fontSize: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: PALETTE.textMuted, fontSize: 13 },
  dot: { color: PALETTE.textDim, fontSize: 13 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(56,189,248,0.12)',
  },
  runChip: { backgroundColor: 'rgba(251,146,60,0.12)' },
  modeTag: { color: PALETTE.walkPrimary, fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  runTag: { color: PALETTE.runPrimary },
  date: { color: PALETTE.textDim, fontSize: 12 },
});

// ── Section title ─────────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return <Text style={sectionTitleStyle}>{title}</Text>;
}

const sectionTitleStyle = {
  color: PALETTE.textDim as string,
  fontWeight: '700' as const,
  fontSize: 11,
  letterSpacing: 2.5,
  textTransform: 'uppercase' as const,
  marginTop: 20,
  marginBottom: 10,
};

// ── Main screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const ensureUser = useUserStore((s) => s.ensureUser);
  const setUser = useUserStore((s) => s.setUser);
  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);
  const setRuns = useRunsStore((s) => s.setRuns);
  const router = useRouter();

  const [recentRuns, setRecentRuns] = useState<ApiRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    const u = useUserStore.getState().user ?? (await ensureUser());
    const { user: fresh, recentRuns: runs } = await api.getUser(u.id);
    setUser(fresh);
    setRecentRuns(runs);
    setRuns(runs);
  }, [ensureUser, setUser, setRuns]);

  useEffect(() => {
    setLoading(true);
    load()
      .then(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      })
      .finally(() => setLoading(false));
  }, [load, fadeAnim]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  if (loading || !user) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={PALETTE.primary} />
      </SafeAreaView>
    );
  }

  const level = getLevel(user.territoryCount);

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          contentContainerStyle={styles.container}
          ListHeaderComponent={
            <>
              {/* Hero section */}
              <View style={styles.hero}>
                <View style={styles.heroLeft}>
                  <View style={[styles.avatar, { backgroundColor: user.color }]}>
                    <Text style={styles.avatarText}>
                      {user.username.slice(0, 2).toUpperCase()}
                    </Text>
                    <View style={[styles.levelDot, { backgroundColor: level.color }]} />
                  </View>
                  <View style={styles.heroInfo}>
                    <Text style={styles.username} numberOfLines={1}>{user.username}</Text>
                    <View style={styles.heroSubRow}>
                      <Ionicons name={level.icon as never} size={12} color={level.color} />
                      <Text style={[styles.heroSub, { color: level.color }]}>{level.name}</Text>
                    </View>
                  </View>
                </View>
                <Pressable onPress={signOut} style={styles.signOutBtn}>
                  <Text style={styles.signOutText}>Sign out</Text>
                </Pressable>
              </View>

              {/* Level progress */}
              <View style={styles.card}>
                <LevelBadge tiles={user.territoryCount} />
              </View>

              {/* Stats grid */}
              <View style={styles.statsGrid}>
                <StatBox value={String(user.territoryCount)} label="Tiles Owned" color={PALETTE.text} />
                <StatBox value={formatDistance(user.totalDistance)} label="Total Distance" color={PALETTE.highlight} />
                <StatBox value={user.rank ? `#${user.rank}` : '—'} label="Global Rank" color={level.color} />
              </View>

              <SectionTitle title="Recent Runs" />
              {recentRuns.length === 0 && (
                <View style={styles.emptyRuns}>
                  <Ionicons name="map-outline" size={36} color={PALETTE.textDim} style={{ opacity: 0.35 }} />
                  <Text style={styles.emptyTitle}>No runs yet</Text>
                  <Text style={styles.emptySub}>Start a run to claim your first tiles</Text>
                </View>
              )}
            </>
          }
          data={recentRuns}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RunCard
              run={item}
              onPress={() => router.push({ pathname: '/run-detail', params: { runId: item.id } })}
            />
          )}
          ListFooterComponent={
            <View style={{ height: 40 }} />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PALETTE.primary}
            />
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}

function StatBox({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={statBoxStyles.box}>
      <Text style={[statBoxStyles.value, { color }]}>{value}</Text>
      <Text style={statBoxStyles.label}>{label}</Text>
    </View>
  );
}

const statBoxStyles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: PALETTE.surfaceCard,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
  },
  value: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { color: PALETTE.textDim, fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textAlign: 'center' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 24 },

  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 4,
  },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
  },
  avatarText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: 0.5,
  },
  levelDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: PALETTE.background,
  },
  heroInfo: { flex: 1 },
  username: {
    color: PALETTE.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  heroSub: {
    color: PALETTE.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  signOutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  signOutText: {
    color: PALETTE.textDim,
    fontSize: 12,
    fontWeight: '600',
  },

  // Level card
  card: {
    backgroundColor: PALETTE.surfaceCard,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    padding: 18,
    marginBottom: 8,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },

  // Empty runs
  emptyRuns: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  emptyTitle: { color: PALETTE.textMuted, fontSize: 15, fontWeight: '600' },
  emptySub: { color: PALETTE.textDim, fontSize: 13 },
});
