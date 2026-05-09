import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/src/components/Text';

import { PALETTE } from '@/src/constants/game';
import { ApiUser, api } from '@/src/services/api';
import { useTilesStore } from '@/src/store/tilesStore';
import { useUserStore } from '@/src/store/userStore';

// ── Nearby radius in degrees (~2 km) ─────────────────────────────────────────
const NEARBY_DEG = 0.018;

// ── Medal colours (gold / silver / bronze) ────────────────────────────────────
const MEDAL_COLORS = ['#F59E0B', '#9CA3AF', '#CD7C39'];

// ── Segmented tab control ─────────────────────────────────────────────────────

function TabToggle({
  active,
  onChange,
}: {
  active: 'global' | 'nearby';
  onChange: (v: 'global' | 'nearby') => void;
}) {
  const slideAnim = useRef(new Animated.Value(active === 'global' ? 0 : 1)).current;
  const [segW, setSegW] = useState(0);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: active === 'global' ? 0 : 1,
      tension: 100,
      friction: 12,
      useNativeDriver: false,
    }).start();
  }, [active, slideAnim]);

  const indicatorX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 3 + segW],
  });

  return (
    <View
      style={tabStyles.track}
      onLayout={(e) => setSegW((e.nativeEvent.layout.width - 6) / 2)}>
      {segW > 0 && (
        <Animated.View
          style={[tabStyles.indicator, { width: segW, transform: [{ translateX: indicatorX }] }]}
          pointerEvents="none"
        />
      )}
      {(['global', 'nearby'] as const).map((tab) => {
        const isActive = active === tab;
        return (
          <Pressable key={tab} style={tabStyles.option} onPress={() => onChange(tab)}>
           
            <Text style={[tabStyles.label, isActive ? tabStyles.labelActive : tabStyles.labelInactive]}>
              {tab === 'global' ? 'Global' : 'Nearby'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: PALETTE.surfaceElevated,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    padding: 3,
    height: 44,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 100,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    zIndex: 1,
  },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  labelActive: { color: '#000' },
  labelInactive: { color: PALETTE.textDim },
});

// ── Row ───────────────────────────────────────────────────────────────────────

function LeaderRow({
  user,
  rank,
  isMe,
  nearby,
}: {
  user: ApiUser;
  rank: number;
  isMe: boolean;
  nearby?: boolean;
}) {
  const isTop3 = rank <= 3;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      delay: rank * 40,
      useNativeDriver: true,
    }).start();
  }, [rank, fadeAnim]);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={[rowStyles.row, isMe && rowStyles.rowMe]}>
        {/* Rank / medal */}
        

        {/* Avatar dot */}
        <View style={[rowStyles.avatar, { backgroundColor: user.color }]}>
          <Text style={rowStyles.avatarText}>{user.username.slice(0, 1).toUpperCase()}</Text>
        </View>

        {/* Name + distance */}
        <View style={rowStyles.info}>
          <Text style={[rowStyles.name, isMe && { color: PALETTE.primary }]} numberOfLines={1}>
            {user.username}
            {isMe && <Text style={rowStyles.meBadge}> · You</Text>}
          </Text>
          <Text style={rowStyles.dist}>
            {(user.totalDistance / 1000).toFixed(1)} km total
          </Text>
        </View>

        {/* Tile count */}
        <View style={rowStyles.scoreWrap}>
          <Text style={[rowStyles.score, isTop3 && { color: MEDAL_COLORS[rank - 1] }]}>
            {user.territoryCount}
          </Text>
          <Text style={rowStyles.scoreLabel}>{nearby ? 'nearby' : 'tiles'}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: PALETTE.surfaceCard,
    borderRadius: 16,
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  rowMe: {
    borderColor: PALETTE.borderLight,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  medalWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rank: {
    width: 34,
    color: PALETTE.textDim,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#000', fontWeight: '800', fontSize: 14 },
  info: { flex: 1 },
  name: { color: PALETTE.text, fontWeight: '600', fontSize: 15 },
  meBadge: { color: PALETTE.textDim, fontWeight: '400', fontSize: 13 },
  dist: { color: PALETTE.textDim, fontSize: 11, marginTop: 2 },
  scoreWrap: { alignItems: 'flex-end' },
  score: { color: PALETTE.text, fontWeight: '700', fontSize: 18, fontVariant: ['tabular-nums'] },
  scoreLabel: { color: PALETTE.textDim, fontSize: 9, fontWeight: '600', letterSpacing: 0.8 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const user = useUserStore((s) => s.user);
  const tilesMap = useTilesStore((s) => s.tiles);

  const [tab, setTab] = useState<'global' | 'nearby'>('global');
  const [globalUsers, setGlobalUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const headerFade = useRef(new Animated.Value(0)).current;

  const load = async () => {
    const [{ users }, loc] = await Promise.all([
      api.getLeaderboard(),
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
    ]);
    setGlobalUsers(users);
    if (loc) {
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    }
  };

  useEffect(() => {
    setLoading(true);
    load()
      .then(() =>
        Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }).start(),
      )
      .finally(() => setLoading(false));
  }, [headerFade]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  // Nearby: find users who own tiles within ~2km of current location
  const nearbyUsers = useMemo(() => {
    if (!userLocation) return globalUsers.slice(0, 20);

    const nearbyOwnerIds = new Set<string>();
    for (const tile of Object.values(tilesMap)) {
      if (!tile.ownerId || !tile.boundary.length) continue;
      const center = tile.boundary[0];
      const dLat = Math.abs(center.latitude - userLocation.lat);
      const dLng = Math.abs(center.longitude - userLocation.lng);
      if (dLat < NEARBY_DEG && dLng < NEARBY_DEG) {
        nearbyOwnerIds.add(tile.ownerId);
      }
    }

    // Ensure current user is always in nearby if authenticated
    if (user?.id) nearbyOwnerIds.add(user.id);

    const filtered = globalUsers.filter((u) => nearbyOwnerIds.has(u.id));
    return filtered.length > 0 ? filtered : globalUsers.slice(0, 20);
  }, [globalUsers, tilesMap, userLocation, user]);

  const displayed = tab === 'global' ? globalUsers : nearbyUsers;
  const myGlobalRank = globalUsers.findIndex((u) => u.id === user?.id) + 1;
  const myNearbyRank = nearbyUsers.findIndex((u) => u.id === user?.id) + 1;
  const myRank = tab === 'global' ? myGlobalRank : myNearbyRank;
  const myEntry = globalUsers.find((u) => u.id === user?.id);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Fixed header */}
      <Animated.View style={[styles.header, { opacity: headerFade }]}>
        <View>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>
            {tab === 'global' ? `${globalUsers.length} runners worldwide` : `${nearbyUsers.length} runners nearby`}
          </Text>
        </View>
        {myRank > 0 && (
          <View style={styles.myRankBadge}>
            <Text style={styles.myRankLabel}>YOUR RANK</Text>
            <Text style={styles.myRankValue}>#{myRank}</Text>
          </View>
        )}
      </Animated.View>

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        <TabToggle active={tab} onChange={setTab} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PALETTE.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PALETTE.primary} />
          }>

          {/* My stats card (if not in top display) */}
          {myEntry && myRank > 10 && (
            <>
              <Text style={styles.sectionLabel}>YOUR POSITION</Text>
              <LeaderRow
                user={myEntry}
                rank={myRank}
                isMe
                nearby={tab === 'nearby'}
              />
              <View style={styles.separator} />
              <Text style={styles.sectionLabel}>
                {tab === 'global' ? 'GLOBAL RANKING' : 'NEARBY RANKING'}
              </Text>
            </>
          )}

          {displayed.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={40} color={PALETTE.textDim} style={{ opacity: 0.4 }} />
              <Text style={styles.emptyTitle}>No runners yet</Text>
              <Text style={styles.emptySub}>
                {tab === 'nearby'
                  ? 'Explore your area to discover nearby runners'
                  : 'Be the first to claim territory!'}
              </Text>
            </View>
          ) : (
            displayed.map((u, i) => (
              <LeaderRow
                key={u.id}
                user={u}
                rank={i + 1}
                isMe={u.id === user?.id}
                nearby={tab === 'nearby'}
              />
            ))
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {
    color: PALETTE.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: PALETTE.textDim,
    fontSize: 13,
    marginTop: 2,
  },
  myRankBadge: {
    backgroundColor: PALETTE.surfaceCard,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  myRankLabel: {
    color: PALETTE.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  myRankValue: {
    color: PALETTE.text,
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },

  tabRow: { paddingHorizontal: 20, marginBottom: 12 },

  list: { paddingHorizontal: 16, paddingBottom: 24 },

  sectionLabel: {
    color: PALETTE.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
    marginTop: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PALETTE.border,
    marginVertical: 12,
  },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { color: PALETTE.textMuted, fontSize: 16, fontWeight: '600' },
  emptySub: { color: PALETTE.textDim, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
});
