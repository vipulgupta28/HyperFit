import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '@/src/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PALETTE } from '@/src/constants/game';
import { useUserStore } from '@/src/store/userStore';

WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

const GOOGLE_IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '225862909743-hmts13ljvuuj0dj60us1b47obfav8gu8.apps.googleusercontent.com';
const GOOGLE_WEB_CLIENT_ID = '225862909743-dbpr56bet94sn3ctlsrrvfauirq10eai.apps.googleusercontent.com';

const HEX_POSITIONS = [
  { x: -30, y: 60, size: 130, opacity: 0.07, delay: 0 },
  { x: width - 70, y: 100, size: 100, opacity: 0.05, delay: 400 },
  { x: width * 0.4, y: 40, size: 75, opacity: 0.06, delay: 200 },
  { x: 50, y: width * 0.8, size: 110, opacity: 0.04, delay: 600 },
  { x: width - 50, y: width * 0.9, size: 140, opacity: 0.05, delay: 300 },
  { x: width * 0.25, y: width * 1.1, size: 90, opacity: 0.05, delay: 500 },
  { x: -20, y: width * 1.3, size: 120, opacity: 0.06, delay: 100 },
];

function HexShape({ x, y, size, opacity, delay }: typeof HEX_POSITIONS[0]) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const seq = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ]),
    );
    seq.start();
    return () => seq.stop();
  }, [anim, delay]);

  return (
    <Animated.View
      style={[
        styles.hexShape,
        {
          left: x,
          top: y,
          width: size,
          height: size * 0.866,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [opacity * 0.4, opacity] }),
        },
      ]}
    />
  );
}

// ── Page dot indicator ───────────────────────────────────────────────────────

function PageDots({ scrollX }: { scrollX: Animated.Value }) {
  return (
    <View style={styles.dotsRow}>
      {[0, 1, 2].map((i) => {
        const dotWidth = scrollX.interpolate({
          inputRange: [(i - 1) * width, i * width, (i + 1) * width],
          outputRange: [6, 24, 6],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange: [(i - 1) * width, i * width, (i + 1) * width],
          outputRange: [0.25, 1, 0.25],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity }]} />
        );
      })}
    </View>
  );
}

// ── Feature row (How to Play) ────────────────────────────────────────────────

function FeatureRow({
  icon,
  color,
  gradient,
  title,
  desc,
}: {
  icon: string;
  color: string;
  gradient: [string, string];
  title: string;
  desc: string;
}) {
  return (
    <View style={styles.featureRow}>
      <LinearGradient colors={[gradient[0] + '30', gradient[1] + '10']} style={styles.featureIconWrap}>
        <Ionicons name={icon as never} size={22} color={color} />
      </LinearGradient>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const router = useRouter();
  const loginOAuth = useUserStore((s) => s.loginOAuth);
  const registerUser = useUserStore((s) => s.registerUser);

  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [showUsernameSheet, setShowUsernameSheet] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);

  const pendingUserIdRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(300)).current;
  const sheetBackdrop = useRef(new Animated.Value(0)).current;

  const [request, response, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri: AuthSession.makeRedirectUri({ scheme: 'territoryrun' }),
  });

  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSuccess(response.authentication?.accessToken ?? '');
    }
  }, [response]);

  const goToPage = (page: number) => {
    scrollRef.current?.scrollTo({ x: width * page, animated: true });
    setCurrentPage(page);
  };

  // ── Username sheet ───────────────────────────────────────────────────────

  const openUsernameSheet = (userId: string | null, suggested: string) => {
    pendingUserIdRef.current = userId;
    setUsernameInput(suggested);
    setUsernameError('');
    setShowUsernameSheet(true);
    Animated.parallel([
      Animated.timing(sheetBackdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(sheetAnim, { toValue: 0, tension: 75, friction: 14, useNativeDriver: true }),
    ]).start();
  };

  const closeUsernameSheet = () => {
    Animated.parallel([
      Animated.timing(sheetBackdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setShowUsernameSheet(false);
      pendingUserIdRef.current = null;
    });
  };

  const confirmUsername = async () => {
    const trimmed = usernameInput.trim();
    if (trimmed.length < 2) { setUsernameError('At least 2 characters required'); return; }
    if (trimmed.length > 20) { setUsernameError('20 characters max'); return; }
    const userId = pendingUserIdRef.current!;
    closeUsernameSheet();
    setLoading(userId.startsWith('apple_') ? 'apple' : 'google');
    try {
      await registerUser(userId, trimmed);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Error', 'Could not complete sign-in. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  // ── Auth handlers ────────────────────────────────────────────────────────

  const handleGoogleSuccess = async (accessToken: string) => {
    try {
      setLoading('google');
      const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const googleUser = await res.json() as { id: string; name?: string; email?: string };
      const userId = `google_${googleUser.id}`;
      const { isNew } = await loginOAuth(userId);
      if (!isNew) { router.replace('/(tabs)'); return; }
      const suggested = googleUser.name ?? googleUser.email?.split('@')[0] ?? '';
      setLoading(null);
      openUsernameSheet(userId, suggested);
    } catch {
      Alert.alert('Sign-in failed', 'Could not complete Google sign-in. Please try again.');
      setLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
   
    setLoading('google');
    try { await promptGoogleAsync(); } finally { setLoading(null); }
  };

  const handleAppleSignIn = async () => {
    setLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const userId = `apple_${credential.user}`;
      const { isNew } = await loginOAuth(userId);
      if (!isNew) { router.replace('/(tabs)'); return; }
      const firstName = credential.fullName?.givenName;
      const lastName = credential.fullName?.familyName;
      const suggested = firstName && lastName
        ? `${firstName}${lastName}`
        : firstName ?? credential.email?.split('@')[0] ?? '';
      setLoading(null);
      openUsernameSheet(userId, suggested);
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign-in failed', 'Could not complete Apple sign-in. Please try again.');
      }
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#0A0C1A', '#06080F', '#0C0810']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Hex grid decoration */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {HEX_POSITIONS.map((hex, i) => <HexShape key={i} {...hex} />)}
      </View>

      <SafeAreaView style={styles.safe}>
        {/* Skip button — pages 0 & 1 */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          {currentPage < 2 && (
            <Pressable onPress={() => goToPage(2)} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
              <Ionicons name="chevron-forward" size={13} color={PALETTE.textDim} />
            </Pressable>
          )}
        </View>

        {/* Pager */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false },
          )}
          onMomentumScrollEnd={(e) => {
            setCurrentPage(Math.round(e.nativeEvent.contentOffset.x / width));
          }}>

          {/* ── PAGE 1: Intro ── */}
          {pageHeight > 0 && (
            <View style={[styles.page, { height: pageHeight }]}>
              <View style={styles.pageContent}>
              <Text style={styles.logo}>HYPERFIT</Text>
                <Text style={styles.appTagline}>CLAIM YOUR TERRITORY</Text>
                <Text style={styles.appDesc}>
                  Walk and run through the real world to capture hexagonal tiles on the map.
                  Build an empire, defend your ground.
                </Text>
              </View>

              <Pressable style={styles.nextBtn} onPress={() => goToPage(1)}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']}
                  style={styles.nextBtnInner}>
                  <Text style={styles.nextBtnText}>How it works</Text>
                  <Ionicons name="arrow-forward" size={16} color={PALETTE.text} />
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {/* ── PAGE 2: How to Play ── */}
          {pageHeight > 0 && (
            <View style={[styles.page, { height: pageHeight }]}>
              <View style={styles.pageContent}>
                <View style={styles.howHeader}>
                  <Text style={styles.howEyebrow}>HOW IT WORKS</Text>
                  <Text style={styles.howTitle}>Three simple rules.</Text>
                </View>

                <View style={styles.featuresCard}>
                  <FeatureRow
                    icon="walk-outline"
                    color={PALETTE.walkPrimary}
                    gradient={['#38BDF8', '#0EA5E9']}
                    title="Move through the city"
                    desc="Walk or run outside — every step you take claims the hexagonal tiles beneath your feet."
                  />
                  <View style={styles.featureDivider} />
                  <FeatureRow
                    icon="hexagon-outline"
                    color="#A78BFA"
                    gradient={['#8B5CF6', '#6D28D9']}
                    title="Build your territory"
                    desc="Tiles you capture are painted your colour on the shared map. Stack them to grow your empire."
                  />
                  <View style={styles.featureDivider} />
                  <FeatureRow
                    icon="shield-outline"
                    color={PALETTE.runPrimary}
                    gradient={['#FB923C', '#F97316']}
                    title="Defend your ground"
                    desc="Tiles gain strength the more you run through them. Stay active or rivals will reclaim them."
                  />
                </View>
              </View>

              <Pressable style={styles.nextBtn} onPress={() => goToPage(2)}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.07)']}
                  style={styles.nextBtnInner}>
                  <Text style={styles.nextBtnText}>Get started</Text>
                  <Ionicons name="arrow-forward" size={16} color={PALETTE.text} />
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {/* ── PAGE 3: Auth ── */}
          {pageHeight > 0 && (
            <View style={[styles.page, { height: pageHeight }]}>
              <View style={styles.pageContent}>
                <View style={styles.authHero}>
                  <View style={styles.authIconRing}>
                    <LinearGradient
                      colors={['rgba(56,189,248,0.2)', 'rgba(139,92,246,0.2)']}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Ionicons name="map-outline" size={32} color={PALETTE.text} />
                  </View>
                  <Text style={styles.authTitle}>Join the map</Text>
                  <Text style={styles.authSub}>
                    Create your account and start claiming territory today.
                  </Text>
                </View>
              </View>

              <View style={styles.authSection}>
                {Platform.OS === 'ios' && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.authBtn,
                      pressed && styles.authBtnPressed,
                      isLoading && loading !== 'apple' && styles.authBtnDisabled,
                    ]}
                    onPress={handleAppleSignIn}
                    disabled={isLoading}>
                    <Ionicons name="logo-apple" size={25} color="#000" />
                    <Text style={styles.authBtnText}>
                      {loading === 'apple' ? 'Signing in…' : 'Continue with Apple'}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.authBtn,
                    styles.authBtnOutline,
                    pressed && styles.authBtnPressed,
                    isLoading && loading !== 'google' && styles.authBtnDisabled,
                  ]}
                  onPress={handleGoogleSignIn}
                  disabled={isLoading}>
                  <View style={styles.googleIconWrap}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={[styles.authBtnText, styles.authBtnTextOutline]}>
                    {loading === 'google' ? 'Signing in…' : 'Continue with Google'}
                  </Text>
                </Pressable>

                <Text style={styles.legal}>
                  By continuing you agree to our Terms of Service and Privacy Policy.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Dots indicator */}
        <PageDots scrollX={scrollX} />

        <View style={{ height: 8 }} />
      </SafeAreaView>

      {/* Username sheet */}
      {showUsernameSheet && (
        <>
          <Animated.View
            style={[styles.sheetBackdrop, { opacity: sheetBackdrop }]}
            pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeUsernameSheet} />
          </Animated.View>

          <KeyboardAvoidingView
            style={styles.sheetKbWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Choose your username</Text>
              <Text style={styles.sheetSub}>This is how others will see you on the map.</Text>

              <TextInput
                style={[styles.sheetInput, usernameError ? styles.sheetInputError : null]}
                value={usernameInput}
                onChangeText={(t) => { setUsernameInput(t); setUsernameError(''); }}
                placeholder="e.g. SwiftRunner42"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={confirmUsername}
                selectionColor={PALETTE.primary}
              />
              {usernameError ? (
                <Text style={styles.sheetError}>{usernameError}</Text>
              ) : (
                <Text style={styles.sheetHint}>{usernameInput.trim().length}/20</Text>
              )}

              <Pressable
                style={({ pressed }) => [styles.sheetConfirmBtn, pressed && { opacity: 0.85 }]}
                onPress={confirmUsername}>
                <Text style={styles.sheetConfirmText}>Continue</Text>
              </Pressable>
            </Animated.View>
          </KeyboardAvoidingView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },

  hexShape: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 4,
    borderColor: 'white',
    transform: [{ rotate: '30deg' }],
  },

  logo: {
    color: "white",
    fontSize: 45,
    fontWeight: 700,
    paddingBottom: 10,
    letterSpacing: 20,
    textAlign: "center",
    alignSelf: "center",
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    minHeight: 44,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skipText: {
    color: PALETTE.textDim,
    fontSize: 14,
    fontWeight: '500',
  },

  // Page dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },

  // Pages
  page: {
    width,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  pageContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
  },

  // Page 1 — Intro
  logoImg: {
    width: width * 0.72,
    height: width ,
    marginBottom: 32,
  },
  appTagline: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.textMuted,
    letterSpacing: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  appDesc: {
    fontSize: 15,
    color: PALETTE.textDim,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },

  // Page 2 — How it works
  howHeader: {
    alignSelf: 'flex-start',
    marginBottom: 28,
  },
  howEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.textDim,
    letterSpacing: 3,
    marginBottom: 6,
  },
  howTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: PALETTE.text,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  featuresCard: {
    width: '100%',
    backgroundColor: PALETTE.surfaceCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 20,
    gap: 0,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 14,
  },
  featureDivider: {
    height: 1,
    backgroundColor: PALETTE.border,
    marginHorizontal: -20,
  },
  featureIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: { flex: 1, gap: 3 },
  featureTitle: {
    color: PALETTE.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  featureDesc: {
    color: PALETTE.textDim,
    fontSize: 13,
    lineHeight: 19,
  },

  // Next button (pages 1 & 2)
  nextBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  nextBtnInner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnText: {
    color: PALETTE.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Page 3 — Auth hero
  authHero: {
    alignItems: 'center',
    gap: 14,
  },
  authIconRing: {
    width: 80,
    height: 80,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  authTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: PALETTE.text,
    letterSpacing: -0.5,
  },
  authSub: {
    fontSize: 15,
    color: PALETTE.textDim,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },

  // Auth section
  authSection: {
    gap: 12,
    paddingBottom: 4,
  },
  authBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 56,
    gap: 12,
  },
  authBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  authBtnPressed: { opacity: 0.75 },
  authBtnDisabled: { opacity: 0.35 },
  authBtnText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  authBtnTextOutline: {
    color: PALETTE.text,
  },
  googleIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  legal: {
    color: PALETTE.textDim,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 2,
  },

  // Username sheet
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 10,
  },
  sheetKbWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 11,
  },
  sheet: {
    backgroundColor: '#0D0F1A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOpacity: 0.9,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -8 },
    elevation: 30,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 22,
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  sheetSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 22,
  },
  sheetInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sheetInputError: { borderColor: 'rgba(248,113,113,0.6)' },
  sheetError: {
    color: 'rgba(248,113,113,0.85)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    marginLeft: 4,
  },
  sheetHint: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 11,
    marginTop: 6,
    marginLeft: 4,
    textAlign: 'right',
  },
  sheetConfirmBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  sheetConfirmText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
