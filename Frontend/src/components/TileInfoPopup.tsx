import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PALETTE } from '../constants/game';
import { ApiTile, api } from '../services/api';

const SHEET_HEIGHT = 290;

function abbrevH3(h3Index: string): string {
  if (h3Index.length <= 14) return h3Index;
  return `${h3Index.slice(0, 8)}…${h3Index.slice(-4)}`;
}

interface TileInfoPopupProps {
  tile: ApiTile;
  meUserId?: string | null;
  onClose: () => void;
  /** Bottom offset so the sheet clears the tab bar + safe area */
  bottomInset?: number;
}

const usernameCache = new Map<string, string>();

export function TileInfoPopup({
  tile,
  meUserId,
  onClose,
  bottomInset = 74,
}: TileInfoPopupProps) {
  const isMine = meUserId != null && tile.ownerId === meUserId;
  const [ownerName, setOwnerName] = useState<string | null>(
    tile.ownerId ? usernameCache.get(tile.ownerId) ?? null : null,
  );
  const [loading, setLoading] = useState<boolean>(
    !!tile.ownerId && !isMine && !usernameCache.has(tile.ownerId),
  );

  // Slide-up animation
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 14,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(onClose);
  };

  // Fetch owner username
  useEffect(() => {
    if (!tile.ownerId || isMine) return;
    const cached = usernameCache.get(tile.ownerId);
    if (cached) {
      setOwnerName(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getUser(tile.ownerId)
      .then(({ user }) => {
        if (cancelled) return;
        usernameCache.set(user.id, user.username);
        setOwnerName(user.username);
      })
      .catch(() => { if (!cancelled) setOwnerName(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tile.ownerId, isMine]);

  const ownerLabel = (() => {
    if (!tile.ownerId) return 'Unclaimed';
    if (isMine) return 'You';
    if (loading) return '…';
    return ownerName ?? 'Unknown runner';
  })();

  const ownerColor = tile.ownerColor ?? PALETTE.textDim;
  const updatedAgo = formatAgo(Date.now() - tile.lastUpdated);
  const strengthPct = Math.min(100, (tile.strength / 10) * 100);

  return (
    <>
      {/* Tap-away backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
      </Animated.View>

      {/* Sliding sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { bottom: bottomInset, transform: [{ translateY }] },
        ]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.swatch, { backgroundColor: tile.ownerId ? ownerColor : PALETTE.surfaceElevated }]}>
            {tile.ownerId ? (
              <Text style={styles.swatchLetter}>
                {(isMine ? 'Y' : ownerName?.[0] ?? '?').toUpperCase()}
              </Text>
            ) : (
              <Ionicons name="add-outline" size={18} color={PALETTE.textDim} />
            )}
          </View>

          <View style={styles.ownerBlock}>
            <Text style={styles.eyebrow}>OWNER</Text>
            <View style={styles.ownerRow}>
              <Text
                style={[
                  styles.ownerName,
                  { color: tile.ownerId ? ownerColor : PALETTE.textDim },
                ]}
                numberOfLines={1}>
                {ownerLabel}
              </Text>
              {loading && (
                <ActivityIndicator size="small" color={PALETTE.textDim} style={{ marginLeft: 6 }} />
              )}
            </View>
          </View>

          <Pressable onPress={dismiss} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={15} color={PALETTE.textMuted} />
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <TileStat label="Cell" value={abbrevH3(tile.h3Index)} />
          <View style={styles.statDivider} />
          <TileStat label="Strength" value={tile.ownerId ? `${tile.strength} / 10` : '—'} />
          <View style={styles.statDivider} />
          <TileStat label="Updated" value={updatedAgo} />
        </View>

        {/* Strength bar */}
        {tile.ownerId && (
          <View style={styles.barSection}>
            <View style={styles.barHeader}>
              <Text style={styles.barLabel}>COVERAGE STRENGTH</Text>
              <Text style={[styles.barPct, { color: ownerColor }]}>{Math.round(strengthPct)}%</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${strengthPct}%` as `${number}%`,
                    backgroundColor: ownerColor,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Unclaimed hint */}
        {!tile.ownerId && (
          <View style={styles.unclaimedCta}>
            <Ionicons name="footsteps-outline" size={14} color={PALETTE.textDim} style={{ marginRight: 8 }} />
            <Text style={styles.unclaimedText}>Walk or run through this tile to claim it</Text>
          </View>
        )}
      </Animated.View>
    </>
  );
}

function TileStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function formatAgo(ms: number): string {
  if (ms < 0) return 'now';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,10,0.98)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingHorizontal: 20,
    paddingBottom: 22,
    zIndex: 11,
    shadowColor: '#000',
    shadowOpacity: 0.85,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -12 },
    elevation: 24,
  },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: PALETTE.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 18,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  swatch: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  swatchLetter: { color: '#000', fontWeight: '800', fontSize: 18 },
  ownerBlock: { flex: 1 },
  eyebrow: {
    color: PALETTE.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  ownerRow: { flexDirection: 'row', alignItems: 'center' },
  ownerName: { fontWeight: '700', fontSize: 19, letterSpacing: -0.3 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PALETTE.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    marginBottom: 16,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: PALETTE.border,
    marginHorizontal: 10,
  },
  stat: { flex: 1 },
  statLabel: {
    color: PALETTE.textDim,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  statValue: { color: PALETTE.text, fontWeight: '600', fontSize: 13 },

  barSection: { gap: 8 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barLabel: { color: PALETTE.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  barPct: { fontSize: 11, fontWeight: '700' },
  barTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: PALETTE.surfaceElevated,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3, opacity: 0.85 },

  unclaimedCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  unclaimedText: { color: PALETTE.textDim, fontSize: 12, fontWeight: '500', flex: 1 },
});
