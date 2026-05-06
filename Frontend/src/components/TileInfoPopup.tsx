import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PALETTE } from '../constants/game';
import { ApiTile, api } from '../services/api';

function abbrevH3(h3Index: string): string {
  if (h3Index.length <= 14) return h3Index;
  return `${h3Index.slice(0, 8)}…${h3Index.slice(-4)}`;
}

interface TileInfoPopupProps {
  tile: ApiTile;
  meUserId?: string | null;
  onClose: () => void;
}

const usernameCache = new Map<string, string>();

export function TileInfoPopup({ tile, meUserId, onClose }: TileInfoPopupProps) {
  const insets = useSafeAreaInsets();
  const isMine = meUserId != null && tile.ownerId === meUserId;
  const [ownerName, setOwnerName] = useState<string | null>(
    tile.ownerId ? usernameCache.get(tile.ownerId) ?? null : null,
  );
  const [loading, setLoading] = useState<boolean>(
    !!tile.ownerId && !isMine && !usernameCache.has(tile.ownerId),
  );

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
      .catch(() => {
        if (!cancelled) setOwnerName(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tile.ownerId, isMine]);

  const ownerLabel = (() => {
    if (!tile.ownerId) return 'Unclaimed';
    if (isMine) return 'You';
    if (loading) return 'Loading…';
    return ownerName ?? 'Unknown runner';
  })();

  const ownerColor = tile.ownerColor ?? PALETTE.textDim;
  const updatedAgo = formatAgo(Date.now() - tile.lastUpdated);
  // Position above the tab bar (62px) with a 12px gap
  const bottomOffset = insets.bottom + 62 + 12;

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]}>
      <View style={[styles.card, { borderColor: ownerColor + '50' }]}>
        {/* Header row */}
        <View style={styles.header}>
          <View style={[styles.colorSwatch, { backgroundColor: ownerColor }]} />
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>OWNER</Text>
            <View style={styles.ownerRow}>
              <Text style={styles.ownerName} numberOfLines={1}>
                {ownerLabel}
              </Text>
              {loading && <ActivityIndicator size="small" color={PALETTE.textDim} style={{ marginLeft: 6 }} />}
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={16} color={PALETTE.textMuted} />
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <TileStat label="Cell" value={abbrevH3(tile.h3Index)} />
          <View style={styles.statDivider} />
          <TileStat label="Strength" value={tile.ownerId ? `${tile.strength} / 10` : '—'} />
          <View style={styles.statDivider} />
          <TileStat label="Updated" value={updatedAgo} />
        </View>

        {/* Strength bar */}
        {tile.ownerId && (
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.min(100, (tile.strength / 10) * 100)}%` as `${number}%`,
                  backgroundColor: ownerColor,
                },
              ]}
            />
          </View>
        )}
      </View>
    </View>
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
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  card: {
    backgroundColor: 'rgba(12,12,12,0.97)',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    opacity: 0.9,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: PALETTE.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  ownerName: {
    color: PALETTE.text,
    fontWeight: '700',
    fontSize: 16,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PALETTE.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: PALETTE.border,
    marginHorizontal: 8,
  },
  stat: { flex: 1 },
  statLabel: {
    color: PALETTE.textDim,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statValue: {
    color: PALETTE.text,
    fontWeight: '600',
    fontSize: 13,
    marginTop: 2,
  },
  barTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: PALETTE.surfaceElevated,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    opacity: 0.8,
  },
});
