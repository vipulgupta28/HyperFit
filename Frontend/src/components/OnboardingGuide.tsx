import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';

import { PALETTE } from '../constants/game';

const { width: W, height: H } = Dimensions.get('window');

const ACCENT = '#fff';

// Tab bar height matches _layout.tsx tabBarStyle.height
const TAB_BAR_H = 70;
// Number of tabs in the app (Map | Start | Ranks | Feed | Profile)
const TAB_COUNT = 5;

interface Step {
  title: string;
  body: string;
  icon: string;
  spotlight: { x: number; y: number; w: number; h: number }; // pixels
  cardSide: 'top' | 'bottom';
  spotlightMode?: 'cutout' | 'outline';
}

interface OnboardingGuideProps {
  onDone: () => void;
}

export function OnboardingGuide({ onDone }: OnboardingGuideProps) {
  const [step, setStep] = useState(0);
  const insets = useSafeAreaInsets();

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const spotlightOpacity = useRef(new Animated.Value(0)).current;

  // Derived layout values
  const tabBarTop = H - TAB_BAR_H;
  const tabW = W / TAB_COUNT;

  // HUD card in index.tsx: position absolute, top: 56, left: 16, right: 16
  // top:56 is relative to the screen content area which starts at insets.top
  const hudTop = insets.top + 56;
  const hudH = 58; // paddingVertical:12×2 + ~34pt of stat content

  // Steps with pixel-accurate spotlights
  const steps: Step[] = useMemo(() => [
    {
      title: 'Your Territory Map',
      body: 'The map shows hexagonal tiles. Every tile you walk or run through gets claimed in your colour. Explore and expand your empire.',
      icon: 'map',
      spotlight: { x: 0, y: insets.top, w: W, h: tabBarTop - insets.top },
      cardSide: 'bottom',
    },
    {
      title: 'Live Stats',
      body: 'Your tile count, global rank, and total distance — always visible at a glance at the top of the map.',
      icon: 'stats-chart',
      spotlight: { x: 16, y: hudTop -60, w: W - 32, h: hudH+3 },
      cardSide: 'bottom',
      spotlightMode: 'outline',
    },
    {
      title: 'Tap Any Tile',
      body: 'Tap any coloured tile to see who owns it, how strong their claim is, and when it was last updated.',
      icon: 'finger-print',
      spotlight: { x: W * 0.10, y: H * 0.28, w: W * 0.80, h: H * 0.26 },
      cardSide: 'bottom',
    },
    {
      // Start tab is tab index 1 (0-based: Map=0, Start=1, Ranks=2, Feed=3, Profile=4)
      title: 'Start an Activity',
      body: 'Switch between Walk (strength +1) and Run (strength +2). Hit Start and claim territory in real time as you move.',
      icon: 'flash',
      spotlight: { x: tabW * 1, y: tabBarTop, w: tabW, h: TAB_BAR_H -10},
      cardSide: 'top',
      spotlightMode: 'outline',
    },
    {
      // Ranks tab is tab index 2
      title: 'Compete on Ranks',
      body: "Check the global leaderboard or see who's active nearby. Claim more tiles to climb the rankings.",
      icon: 'trophy',
      spotlight: { x: tabW * 2, y: tabBarTop, w: tabW, h: TAB_BAR_H-10 },
      cardSide: 'top',
      spotlightMode: 'outline',
    },
  ], [insets.top, tabBarTop, tabW, hudTop]);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(spotlightOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [backdropOpacity, cardScale, cardOpacity, spotlightOpacity]);

  // Transition between steps
  const goTo = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(cardScale, { toValue: 0.9, duration: 120, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, tension: 100, friction: 12, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (step < steps.length - 1) {
      goTo(step + 1);
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(spotlightOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(onDone);
    }
  };

  const handleSkip = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(onDone);
  };

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isOutline = (current.spotlightMode ?? 'cutout') === 'outline';

  // Spotlight is already in pixels
  const sl = current.spotlight;

  const CARD_MARGIN = 16;
  const CARD_HEIGHT_EST = 260;
  const CARD_GAP = isOutline ? 50 : 20;
  const cardTop =
    current.cardSide === 'bottom'
      ? sl.y + sl.h + CARD_GAP
      : sl.y - CARD_GAP - CARD_HEIGHT_EST;

  const cardTopClamped = Math.max(CARD_MARGIN + 60, Math.min(cardTop, H - CARD_HEIGHT_EST - CARD_MARGIN));
  const slCenterX = sl.x + sl.w / 2;

  let connTop = 0;
  let connHeight = 0;
  if (isOutline) {
    if (current.cardSide === 'top') {
      connTop = cardTopClamped + CARD_HEIGHT_EST;
      connHeight = sl.y - connTop;
    } else {
      connTop = sl.y + sl.h;
      connHeight = cardTopClamped - connTop;
    }
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Dimmed backdrop */}
      <Animated.View style={{ opacity: backdropOpacity }} pointerEvents="none">
        {isOutline ? (
          <View style={[styles.dim, StyleSheet.absoluteFillObject]} />
        ) : (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: sl.y }]} />
            <View style={[styles.dim, { top: sl.y + sl.h, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.dim, { top: sl.y, left: 0, width: sl.x, height: sl.h }]} />
            <View style={[styles.dim, { top: sl.y, left: sl.x + sl.w, right: 0, height: sl.h }]} />
          </>
        )}
      </Animated.View>

      {/* Spotlight highlight */}
      <Animated.View
        style={[
          styles.spotlightBorder,
          isOutline && styles.spotlightOutlineBorder,
          { opacity: spotlightOpacity, top: sl.y, left: sl.x, width: sl.w, height: sl.h },
        ]}
        pointerEvents="none"
      />

      {/* Corner accents — cutout mode only */}
      {!isOutline && (
        <Animated.View style={{ opacity: spotlightOpacity }} pointerEvents="none">
          <CornerAccent top={sl.y - 2}          left={sl.x - 2}           rotate="0deg"   />
          <CornerAccent top={sl.y - 2}          left={sl.x + sl.w - 18}   rotate="90deg"  />
          <CornerAccent top={sl.y + sl.h - 18}  left={sl.x - 2}           rotate="270deg" />
          <CornerAccent top={sl.y + sl.h - 18}  left={sl.x + sl.w - 18}   rotate="180deg" />
        </Animated.View>
      )}

      {/* Connector line */}
      {isOutline ? (
        connHeight > 0 && (
          <Animated.View
            style={[styles.connectorLine, { opacity: spotlightOpacity, left: slCenterX - 1, top: connTop, height: connHeight }]}
            pointerEvents="none"
          />
        )
      ) : (
        <Animated.View
          style={[
            styles.arrowLine,
            {
              opacity: spotlightOpacity,
              left: W / 2 - 1,
              top: current.cardSide === 'bottom' ? sl.y + sl.h : Math.max(cardTop + CARD_HEIGHT_EST, sl.y - 24),
              height: 20,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Info card */}
      <Animated.View
        style={[
          styles.card,
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
            top: cardTopClamped,
            left: CARD_MARGIN,
            right: CARD_MARGIN,
          },
        ]}
        pointerEvents="box-none">

        <View style={styles.iconCircle}>
          <Ionicons name={current.icon as never} size={22} color={ACCENT} />
        </View>

        <Text style={styles.cardTitle}>{current.title}</Text>
        <Text style={styles.cardBody}>{current.body}</Text>

        {/* Progress dots */}
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.btnRow}>
          <Pressable onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Pressable onPress={handleNext} style={styles.nextBtn}>
            <Text style={styles.nextText}>{isLast ? 'Get Started' : 'Next'}</Text>
            {!isLast && (
              <Ionicons name="arrow-forward" size={14} color="#000" style={{ marginLeft: 4 }} />
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function CornerAccent({ top, left, rotate }: { top: number; left: number; rotate: string }) {
  return (
    <View style={[styles.corner, { top, left, transform: [{ rotate }] }]} />
  );
}

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },

  spotlightBorder: {
    position: 'absolute',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#fff',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  spotlightOutlineBorder: {
    borderColor: '#fff',
    borderWidth: 2,
    borderRadius: 14,
    shadowOpacity: 0.5,
    shadowRadius: 18,
  },
  connectorLine: {
    position: 'absolute',
    width: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  corner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopColor: '#fff',
    borderLeftColor: '#fff',
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderRadius: 3,
  },

  arrowLine: {
    position: 'absolute',
    width: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },

  card: {
    position: 'absolute',
    backgroundColor: 'rgba(8,8,8,0.97)',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.9,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
    elevation: 30,
    zIndex: 100,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  cardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  cardBody: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },

  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginBottom: 20,
  },
  dot: { borderRadius: 4 },
  dotActive: { width: 20, height: 6, backgroundColor: '#fff' },
  dotInactive: { width: 6, height: 6, backgroundColor: 'rgba(255,255,255,0.20)' },

  btnRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  skipText: { color: 'rgba(255,255,255,0.40)', fontSize: 14, fontWeight: '600' },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  nextText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
