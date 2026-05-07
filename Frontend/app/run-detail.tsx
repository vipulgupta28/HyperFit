import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/src/components/Text';
import MapView, { Polyline } from 'react-native-maps';

import { PALETTE } from '@/src/constants/game';
import { SOOTHING_DARK_MAP_STYLE } from '@/src/constants/mapStyle';
import { useRunMetaStore } from '@/src/store/runMetaStore';
import { useRunsStore } from '@/src/store/runsStore';
import { formatDistance, formatDuration, formatPace } from '@/src/utils/geo';

function MetaRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaIcon}>
        <Ionicons name={icon as never} size={16} color={PALETTE.textDim} />
      </View>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

export default function RunDetailScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const router = useRouter();
  const run = useRunsStore((s) => s.runs[runId ?? '']);
  const meta = useRunMetaStore((s) => s.get(runId ?? ''));

  const pathCoords = useMemo(
    () => (run?.path ?? []).map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [run],
  );

  const modeColor = run?.mode === 'run' ? PALETTE.runPrimary : PALETTE.walkPrimary;
  const duration = run?.duration ?? 0;
  const distance = run?.distance ?? 0;
  const pace = duration > 0 && distance > 0 ? formatPace(distance, duration) : '—';

  // Compute bounding region for the path
  const mapRegion = useMemo(() => {
    if (pathCoords.length === 0) return null;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const p of pathCoords) {
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLng = Math.max(maxLng, p.longitude);
    }
    const padLat = Math.max((maxLat - minLat) * 0.3, 0.002);
    const padLng = Math.max((maxLng - minLng) * 0.3, 0.002);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: maxLat - minLat + padLat,
      longitudeDelta: maxLng - minLng + padLng,
    };
  }, [pathCoords]);

  if (!run) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Ionicons name="alert-circle-outline" size={40} color={PALETTE.textDim} />
        <Text style={styles.notFound}>Run not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const startDate = new Date(run.startedAt);
  const dateStr = startDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const avgSpeedKmh = duration > 0 ? (distance * 3600) / duration : 0;
  const caloriesEst = Math.round(distance * 0.06); // rough estimate

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backArrow} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={PALETTE.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {meta?.name ?? (run.mode === 'run' ? 'Run' : 'Walk')}
          </Text>
          <Text style={styles.headerSub}>{dateStr}</Text>
        </View>
        <View style={[styles.modeBadge, { borderColor: modeColor + '50' }]}>
          <Ionicons
            name={run.mode === 'run' ? 'flash' : 'walk'}
            size={12}
            color={modeColor}
          />
          <Text style={[styles.modeBadgeText, { color: modeColor }]}>
            {run.mode === 'run' ? 'Run' : 'Walk'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Map */}
        <View style={styles.mapCard}>
          {mapRegion && pathCoords.length > 1 ? (
            <MapView
              style={styles.map}
              initialRegion={mapRegion}
              userInterfaceStyle="dark"
              customMapStyle={Platform.OS === 'android' ? SOOTHING_DARK_MAP_STYLE : undefined}
              mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              showsUserLocation={false}
              showsMyLocationButton={false}
              showsCompass={false}>
              <Polyline
                coordinates={pathCoords}
                strokeColor={modeColor}
                strokeWidth={4}
                lineJoin="round"
                lineCap="round"
              />
            </MapView>
          ) : (
            <View style={styles.noMap}>
              <Ionicons name="map-outline" size={32} color={PALETTE.textDim} style={{ opacity: 0.4 }} />
              <Text style={styles.noMapText}>No route recorded</Text>
            </View>
          )}

          {/* Route stats overlay on map */}
          {pathCoords.length > 1 && (
            <View style={styles.mapOverlay}>
              <View style={[styles.mapOverlayDot, { backgroundColor: modeColor }]} />
              <Text style={styles.mapOverlayText}>{timeStr}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {meta?.description ? (
          <View style={styles.noteCard}>
            <Ionicons name="document-text-outline" size={14} color={PALETTE.textDim} style={{ marginRight: 8 }} />
            <Text style={styles.noteText}>{meta.description}</Text>
          </View>
        ) : null}

        {/* Primary stats */}
        <View style={styles.primaryStats}>
          <PrimaryStat label="Distance" value={formatDistance(distance)} color={modeColor} />
          <View style={styles.primaryDivider} />
          <PrimaryStat label="Duration" value={formatDuration(duration)} color={PALETTE.text} />
          <View style={styles.primaryDivider} />
          <PrimaryStat label="Pace" value={pace} color={PALETTE.text} />
        </View>

        {/* Secondary stats */}
        <View style={styles.metaCard}>
          <Text style={styles.sectionLabel}>ACTIVITY DETAILS</Text>
          <MetaRow icon="speedometer-outline" label="Avg Speed" value={avgSpeedKmh > 0 ? `${avgSpeedKmh.toFixed(1)} km/h` : '—'} />
          <View style={styles.metaDivider} />
          <MetaRow icon="map-outline" label="Tiles Claimed" value={String(run.capturedTileIds.length)} />
          <View style={styles.metaDivider} />
          <MetaRow icon="flame-outline" label="Est. Calories" value={`${caloriesEst} kcal`} />
          <View style={styles.metaDivider} />
          <MetaRow
            icon="shield-outline"
            label="Tile Strength"
            value={`+${run.mode === 'run' ? '2' : '1'} per tile`}
          />
          <View style={styles.metaDivider} />
          <MetaRow icon="calendar-outline" label="Date" value={dateStr} />
          <View style={styles.metaDivider} />
          <MetaRow icon="time-outline" label="Start Time" value={timeStr} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.primaryStat}>
      <Text style={[styles.primaryValue, { color }]}>{value}</Text>
      <Text style={styles.primaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  backArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle: { color: PALETTE.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  headerSub: { color: PALETTE.textDim, fontSize: 11, marginTop: 2 },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  modeBadgeText: { fontSize: 11, fontWeight: '700' },

  content: { padding: 16 },

  // Map
  mapCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    height: 220,
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  map: { ...StyleSheet.absoluteFillObject },
  noMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noMapText: { color: PALETTE.textDim, fontSize: 13 },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapOverlayDot: { width: 6, height: 6, borderRadius: 3 },
  mapOverlayText: { color: PALETTE.text, fontSize: 12, fontWeight: '600' },

  // Note
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: PALETTE.surfaceCard,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    padding: 14,
    marginBottom: 12,
  },
  noteText: { color: PALETTE.textMuted, fontSize: 13, lineHeight: 18, flex: 1 },

  // Primary stats
  primaryStats: {
    flexDirection: 'row',
    backgroundColor: PALETTE.surfaceCard,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingVertical: 20,
    marginBottom: 12,
  },
  primaryStat: { flex: 1, alignItems: 'center', gap: 4 },
  primaryValue: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  primaryLabel: { color: PALETTE.textDim, fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },
  primaryDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: PALETTE.border,
    marginVertical: 4,
  },

  // Meta card
  metaCard: {
    backgroundColor: PALETTE.surfaceCard,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    padding: 16,
    gap: 0,
  },
  sectionLabel: {
    color: PALETTE.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  metaIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: PALETTE.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLabel: { color: PALETTE.textMuted, fontSize: 14, flex: 1 },
  metaValue: { color: PALETTE.text, fontSize: 14, fontWeight: '600' },
  metaDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PALETTE.border,
    marginLeft: 38,
  },

  // Not found
  notFound: { color: PALETTE.textMuted, fontSize: 16, fontWeight: '600' },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  backBtnText: { color: PALETTE.text, fontWeight: '600' },
});
