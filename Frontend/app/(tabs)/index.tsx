import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Camera, Polyline, Region } from 'react-native-maps';

import { TileInfoPopup } from '@/src/components/TileInfoPopup';
import { TileOverlay } from '@/src/components/TileOverlay';
import { GAME, PALETTE } from '@/src/constants/game';
import { SOOTHING_DARK_MAP_STYLE } from '@/src/constants/mapStyle';
import { useTilesSocket } from '@/src/hooks/useTilesSocket';
import { ApiTile, api } from '@/src/services/api';
import { useRunStore } from '@/src/store/runStore';
import { useTilesStore } from '@/src/store/tilesStore';
import { useUserStore } from '@/src/store/userStore';
import { boundaryOverlapsViewport } from '@/src/utils/geo';

const MAP_STYLE_OPTIONS = [
  { key: 'standard',  label: 'Map',       icon: 'map-outline'    },
  { key: 'satellite', label: 'Satellite', icon: 'globe-outline'  },
  { key: 'hybrid',    label: 'Hybrid',    icon: 'layers-outline' },
] as const;

const FALLBACK_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: GAME.initialMapDelta.latitudeDelta,
  longitudeDelta: GAME.initialMapDelta.longitudeDelta,
};

const MAP_3D_PITCH = 52;
const MAP_FOLLOW_ZOOM = 17.5;

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followModeRef = useRef(true);
  const lastCameraUpdate = useRef(0);

  const tilesMap = useTilesStore((s) => s.tiles);
  const upsertMany = useTilesStore((s) => s.upsertMany);
  const user = useUserStore((s) => s.user);
  const ensureUser = useUserStore((s) => s.ensureUser);
  const refreshUser = useUserStore((s) => s.refreshUser);

  const phase = useRunStore((s) => s.phase);
  const path = useRunStore((s) => s.path);
  const mode = useRunStore((s) => s.mode);
  const distance = useRunStore((s) => s.distance);

  const [region, setRegion] = useState<Region | null>(null);
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [is3D, setIs3D] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [mapStyleMode, setMapStyleMode] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [showStylePicker, setShowStylePicker] = useState(false);

  const router = useRouter();
  const hudFadeAnim = useRef(new Animated.Value(0)).current;
  const bannerSlideAnim = useRef(new Animated.Value(60)).current;

  useTilesSocket();

  // Fade in HUD on mount
  useEffect(() => {
    Animated.timing(hudFadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [hudFadeAnim]);

  // Slide banner in/out when run starts/stops
  useEffect(() => {
    Animated.spring(bannerSlideAnim, {
      toValue: phase !== 'idle' ? 0 : 60,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [phase, bannerSlideAnim]);

  // Auto-enable 3D + follow when run starts
  useEffect(() => {
    if (phase === 'active') {
      setIs3D(true);
      setFollowMode(true);
      followModeRef.current = true;
    } else if (phase === 'idle') {
      setIs3D(false);
    }
  }, [phase]);

  // Location permission + initial position
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setPermission('denied');
        setRegion(FALLBACK_REGION);
        return;
      }
      setPermission('granted');
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          ...GAME.initialMapDelta,
        });
      } catch {
        setRegion(FALLBACK_REGION);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    ensureUser().catch(() => undefined);
  }, [ensureUser]);

  // Auto-follow last GPS point during active run
  useEffect(() => {
    if (!followModeRef.current || path.length === 0 || phase !== 'active') return;
    const last = path[path.length - 1];
    const now = Date.now();
    if (now - lastCameraUpdate.current < 1800) return;
    lastCameraUpdate.current = now;

    const camera: Camera = {
      center: { latitude: last.lat, longitude: last.lng },
      pitch: is3D ? MAP_3D_PITCH : 0,
      heading: 0,
      zoom: MAP_FOLLOW_ZOOM,
      altitude: 300,
    };
    mapRef.current?.animateCamera(camera, { duration: 1200 });
  }, [path, phase, is3D]);

  const fetchVisibleTiles = useCallback(
    async (r: Region) => {
      try {
        const halfLat = r.latitudeDelta / 2;
        const halfLng = r.longitudeDelta / 2;
        const { tiles } = await api.getTiles({
          minLat: r.latitude - halfLat,
          maxLat: r.latitude + halfLat,
          minLng: r.longitude - halfLng,
          maxLng: r.longitude + halfLng,
        });
        upsertMany(tiles);
      } catch {
        // non-fatal
      }
    },
    [upsertMany],
  );

  const onRegionChangeComplete = useCallback(
    (next: Region) => {
      // If user manually panned, exit follow mode
      followModeRef.current = false;
      setFollowMode(false);

      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(() => fetchVisibleTiles(next), 350);
    },
    [fetchVisibleTiles],
  );

  useEffect(() => {
    if (region) fetchVisibleTiles(region);
  }, [region, fetchVisibleTiles]);

  useEffect(() => {
    if (phase === 'idle') refreshUser().catch(() => undefined);
  }, [phase, refreshUser]);

  const visibleTiles = useMemo(() => {
    if (!region) return [];
    const result: ApiTile[] = [];
    for (const t of Object.values(tilesMap)) {
      if (boundaryOverlapsViewport(t.boundary, region)) result.push(t);
    }
    result.sort((a, b) => (a.ownerId ? 1 : 0) - (b.ownerId ? 1 : 0));
    return result;
  }, [tilesMap, region]);

  const pathCoords = useMemo(
    () => path.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [path],
  );

  const handleTilePress = useCallback((tile: ApiTile) => setSelectedTileId(tile.h3Index), []);
  const dismissTileInfo = useCallback(() => setSelectedTileId(null), []);
  const selectedTile = selectedTileId ? tilesMap[selectedTileId] ?? null : null;

  const handleRecenter = () => {
    followModeRef.current = true;
    setFollowMode(true);
    if (path.length > 0 && phase === 'active') {
      const last = path[path.length - 1];
      mapRef.current?.animateCamera({
        center: { latitude: last.lat, longitude: last.lng },
        pitch: is3D ? MAP_3D_PITCH : 0,
        zoom: MAP_FOLLOW_ZOOM,
        altitude: 300,
        heading: 0,
      }, { duration: 800 });
    } else if (region) {
      mapRef.current?.animateToRegion(region, 600);
    }
  };

  const toggle3D = () => {
    const next = !is3D;
    setIs3D(next);
    mapRef.current?.animateCamera({ pitch: next ? MAP_3D_PITCH : 0 }, { duration: 600 });
  };

  const modeColor = mode === 'walk' ? PALETTE.walkPrimary : PALETTE.runPrimary;

  if (!region) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="location-outline" size={36} color={PALETTE.textDim} />
        <Text style={styles.loadingText}>Finding your location…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        userInterfaceStyle="dark"
        customMapStyle={Platform.OS === 'android' && mapStyleMode === 'standard' ? SOOTHING_DARK_MAP_STYLE : undefined}
        mapType={
          mapStyleMode === 'satellite' ? 'satellite'
            : mapStyleMode === 'hybrid' ? 'hybrid'
            : Platform.OS === 'ios'
              ? is3D && phase === 'active' ? 'hybridFlyover' : 'mutedStandard'
              : 'standard'
        }
        showsUserLocation={permission === 'granted'}
        showsMyLocationButton={false}
        showsCompass={false}
        showsBuildings={is3D}
        pitchEnabled={true}
        rotateEnabled={true}
        onRegionChangeComplete={onRegionChangeComplete}>
        {visibleTiles.map((tile) => (
          <TileOverlay
            key={tile.h3Index}
            tile={tile}
            meUserId={user?.id}
            onPress={handleTilePress}
          />
        ))}
        {pathCoords.length > 1 && (
          <Polyline
            coordinates={pathCoords}
            strokeColor={modeColor}
            strokeWidth={3}
            lineDashPattern={[0]}
            lineJoin="round"
            lineCap="round"
          />
        )}
      </MapView>

      {/* Top HUD */}
      <Animated.View style={[styles.topHud, { opacity: hudFadeAnim }]} pointerEvents="box-none">
        <View style={styles.hudCard}>
          <HudStat
            value={String(user?.territoryCount ?? 0)}
            label="Tiles"
            color={PALETTE.text}
          />
          <View style={styles.hudDivider} />
          <HudStat
            value={user?.rank ? `#${user.rank}` : '—'}
            label="Rank"
            color={PALETTE.textMuted}
          />
          <View style={styles.hudDivider} />
          <HudStat
            value={`${(((user?.totalDistance ?? 0) + distance) / 1000).toFixed(1)} km`}
            label="Total"
            color={PALETTE.highlight}
          />
        </View>
      </Animated.View>

      {/* Map control buttons */}
      <View style={styles.mapControls} pointerEvents="box-none">
        <Pressable style={[styles.mapControlBtn, is3D && styles.mapControlBtnActive]} onPress={toggle3D}>
          <Text style={[styles.mapControlText, is3D && { color: PALETTE.runPrimary }]}>3D</Text>
        </Pressable>
        {!followMode && (
          <Pressable style={styles.mapControlBtn} onPress={handleRecenter}>
            <Ionicons name="locate-outline" size={18} color={PALETTE.text} />
          </Pressable>
        )}
        <Pressable
          style={[styles.mapControlBtn, showStylePicker && styles.mapControlBtnActive]}
          onPress={() => setShowStylePicker((v) => !v)}>
          <Ionicons name="layers-outline" size={18} color={showStylePicker ? PALETTE.text : PALETTE.textDim} />
        </Pressable>
        {showStylePicker && (
          <View style={styles.stylePicker}>
            {MAP_STYLE_OPTIONS.map(({ key, label, icon }) => {
              const active = mapStyleMode === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.stylePickerItem, active && styles.stylePickerItemActive]}
                  onPress={() => { setMapStyleMode(key as typeof mapStyleMode); setShowStylePicker(false); }}>
                  <Ionicons name={icon as never} size={13} color={active ? '#000' : PALETTE.textMuted} />
                  <Text style={[styles.stylePickerText, active && styles.stylePickerTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Active run banner */}
      <Animated.View
        style={[
          styles.activeRunBanner,
          {
            transform: [{ translateY: bannerSlideAnim }],
            borderColor: modeColor + '40',
          },
        ]}
        pointerEvents={phase !== 'idle' ? 'auto' : 'none'}>
        <View style={[styles.bannerDot, { backgroundColor: modeColor + '20' }]}>
          <View style={[styles.bannerDotInner, { backgroundColor: modeColor }]} />
        </View>
        <Text style={styles.activeRunText}>
          {phase === 'paused'
            ? 'Run paused'
            : mode === 'walk' ? 'Walk in progress' : 'Run in progress'}
        </Text>
        <Pressable onPress={() => router.navigate('/(tabs)/run')} style={styles.bannerCta}>
          <Text style={[styles.activeRunCta, { color: modeColor }]}>Open</Text>
          <Ionicons name="chevron-forward" size={13} color={modeColor} />
        </Pressable>
      </Animated.View>

      {/* Location denied banner */}
      {permission === 'denied' && (
        <View style={styles.permissionBanner}>
          <Ionicons name="location-outline" size={16} color={PALETTE.danger} style={{ marginRight: 8 }} />
          <Text style={styles.permissionText}>
            Location permission denied. Enable it in Settings to track runs.
          </Text>
        </View>
      )}

      {/* Tile info popup */}
      {selectedTile && (
        <TileInfoPopup
          tile={selectedTile}
          meUserId={user?.id}
          onClose={dismissTileInfo}
          bottomInset={74}
        />
      )}
    </View>
  );
}

function HudStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.hudStat}>
      <Text style={[styles.hudStatValue, { color }]}>{value}</Text>
      <Text style={styles.hudStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.background },
  loadingContainer: {
    flex: 1,
    backgroundColor: PALETTE.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: PALETTE.textMuted, fontSize: 15, fontWeight: '400', letterSpacing: 0.3 },

  // HUD
  topHud: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
  },
  hudCard: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.borderLight,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  hudStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  hudStatValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  hudStatLabel: {
    fontSize: 9,
    color: PALETTE.textDim,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hudDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: PALETTE.border,
  },

  // Map controls
  mapControls: {
    position: 'absolute',
    top: 128,
    right: 16,
    gap: 8,
    alignItems: 'flex-end',
  },
  mapControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapControlBtnActive: {
    borderColor: PALETTE.runPrimary,
  },
  mapControlText: {
    color: PALETTE.text,
    fontWeight: '700',
    fontSize: 12,
  },

  // Active run banner
  activeRunBanner: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(10,10,10,0.92)',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  bannerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
  },
  bannerDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeRunText: { color: PALETTE.text, fontWeight: '600', fontSize: 14, flex: 1 },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  activeRunCta: { fontWeight: '700', fontSize: 14 },

  // Permission banner
  permissionBanner: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(10,10,10,0.9)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.danger,
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionText: {
    color: PALETTE.text,
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  // Map style picker
  stylePicker: {
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.borderLight,
    overflow: 'hidden',
    width: 130,
  },
  stylePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  stylePickerItemActive: {
    backgroundColor: '#fff',
  },
  stylePickerText: {
    color: PALETTE.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  stylePickerTextActive: {
    color: '#000',
  },
});
