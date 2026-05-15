/**
 * Loading indicator prototypes — organic, blobby, black & white, 200×200.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BG = '#07080F';
const FG = '#FFFFFF';

// ─────────────────────────────────────────────────────────────────────────────
// 1. MORPH
// A single white blob drifting through organic shapes. Each corner radius
// oscillates at its own period so the motion never fully repeats.
// ─────────────────────────────────────────────────────────────────────────────

export function MorphLoader() {
  const tl = useRef(new Animated.Value(0)).current;
  const tr = useRef(new Animated.Value(0)).current;
  const br = useRef(new Animated.Value(0)).current;
  const bl = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const corner = (val: Animated.Value, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(val, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
      );

    corner(tl, 2300).start();
    corner(tr, 1900).start();
    corner(br, 2700).start();
    corner(bl, 2050).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(sc, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sc, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [tl, tr, br, bl, sc]);

  const S = 100;
  const scale = sc.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.04] });

  return (
    <View style={styles.cell}>
      <Animated.View
        style={{
          width: S,
          height: S,
          backgroundColor: FG,
          transform: [{ scale }],
          borderTopLeftRadius: tl.interpolate({ inputRange: [0, 1], outputRange: [S * 0.58, S * 0.22] }),
          borderTopRightRadius: tr.interpolate({ inputRange: [0, 1], outputRange: [S * 0.28, S * 0.72] }),
          borderBottomRightRadius: br.interpolate({ inputRange: [0, 1], outputRange: [S * 0.68, S * 0.32] }),
          borderBottomLeftRadius: bl.interpolate({ inputRange: [0, 1], outputRange: [S * 0.32, S * 0.62] }),
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BREATHE
// A filled circle that slowly inhales and exhales. A translucent ring
// blooms outward on each exhale, then dissolves back into nothing.
// ─────────────────────────────────────────────────────────────────────────────

export function BreatheLoader() {
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(phase, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(phase, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [phase]);

  const coreScale  = phase.interpolate({ inputRange: [0, 1], outputRange: [0.68, 1.0] });
  const haloScale  = phase.interpolate({ inputRange: [0, 1], outputRange: [0.68, 1.9] });
  const haloOp     = phase.interpolate({ inputRange: [0, 0.2, 0.75, 1], outputRange: [0, 0.28, 0.08, 0] });

  return (
    <View style={styles.cell}>
      {/* Expanding halo ring */}
      <Animated.View style={[styles.breatheHalo, { transform: [{ scale: haloScale }], opacity: haloOp }]} />
      {/* Breathing core */}
      <Animated.View style={[styles.breatheCore, { transform: [{ scale: coreScale }] }]} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ORBIT
// Three small blobs circle a common center. Each blob independently morphs
// its shape while in orbit, so they feel like living organisms.
// ─────────────────────────────────────────────────────────────────────────────

export function OrbitLoader() {
  const spin  = useRef(new Animated.Value(0)).current;
  const morph = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 5500, easing: Easing.linear, useNativeDriver: true }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(morph, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(morph, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    ).start();
  }, [spin, morph]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const B = 24; // blob side
  const R = 36; // orbit radius

  // Two corner-radius poles that morph between each other with phase offsets
  const r0 = morph.interpolate({ inputRange: [0, 1], outputRange: [B * 0.6, B * 0.2] });
  const r1 = morph.interpolate({ inputRange: [0, 1], outputRange: [B * 0.2, B * 0.6] });
  const r2 = morph.interpolate({ inputRange: [0, 1], outputRange: [B * 0.4, B * 0.6] });
  const r3 = morph.interpolate({ inputRange: [0, 1], outputRange: [B * 0.6, B * 0.4] });

  // Pre-compute fixed X/Y for 3 equidistant orbit positions
  const pos = [0, 120, 240].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: Math.sin(rad) * R - B / 2, y: -Math.cos(rad) * R - B / 2 };
  });

  // Each blob cycles through corner combos with a slight offset feel
  const blobs = [
    [r0, r1, r2, r3],
    [r1, r2, r3, r0],
    [r2, r3, r0, r1],
  ] as const;

  return (
    <View style={styles.cell}>
      {/* 0×0 anchor at cell center — children offset from here */}
      <Animated.View style={{ transform: [{ rotate }] }}>
        {blobs.map(([btl, btr, bbr, bbl], i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: B,
              height: B,      
              backgroundColor: FG,
              left: pos[i].x,
              top: pos[i].y,
              borderTopLeftRadius: btl,
              borderTopRightRadius: btr,
              borderBottomRightRadius: bbr,
              borderBottomLeftRadius: bbl,
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. RIPPLE
// Rings expand outward from a still center point and dissolve before the
// edge, like a drop of water on a dark surface.
// ─────────────────────────────────────────────────────────────────────────────

export function RippleLoader() {
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  const r3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const DURATION = 2400;
    const STAGGER  = DURATION / 3;

    const go = (val: Animated.Value, initialDelay: number) => {
      val.setValue(0);
      Animated.sequence([
        Animated.delay(initialDelay),
        Animated.timing(val, { toValue: 1, duration: DURATION, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start(() => go(val, 0));
    };

    go(r1, 0);
    go(r2, STAGGER);
    go(r3, STAGGER * 2);
  }, [r1, r2, r3]);

  const ring = (val: Animated.Value) => ({
    ...StyleSheet.absoluteFillObject,
    borderRadius: 200,
    borderWidth: 1,
    borderColor: FG as string,
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.04, 1] }) }],
    opacity: val.interpolate({ inputRange: [0, 0.12, 0.65, 1], outputRange: [0, 0.9, 0.35, 0] }),
  });

  return (
    <View style={styles.cell}>
      <Animated.View style={ring(r1)} />
      <Animated.View style={ring(r2)} />
      <Animated.View style={ring(r3)} />
      {/* Still center dot */}
      <View style={styles.rippleDot} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo screen — 2×2 grid
// ─────────────────────────────────────────────────────────────────────────────

export default function LoadingDemoScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.grid}>
        <MorphLoader />
        <BreatheLoader />
        <OrbitLoader />
        <RippleLoader />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 20,
    gap: 16,
  },

  // Shared cell
  cell: {
    width: 200,
    height: 200,
    backgroundColor: BG,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },

  // Breathe
  breatheHalo: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: FG,
  },
  breatheCore: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: FG,
  },

  // Ripple
  rippleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: FG,
  },
});
