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
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '@/src/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PALETTE } from '@/src/constants/game';
import { useUserStore } from '@/src/store/userStore';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

// Replace these with your actual Google OAuth client IDs from Google Cloud Console
// Run: npx expo install expo-auth-session expo-web-browser
const GOOGLE_IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

// Hexagon positions for background decoration
const HEX_POSITIONS = [
  { x: -30, y: 80, size: 120, opacity: 0.07, delay: 0 },
  { x: width - 60, y: 120, size: 90, opacity: 0.05, delay: 400 },
  { x: width * 0.4, y: 60, size: 70, opacity: 0.06, delay: 200 },
  { x: 60, y: height * 0.35, size: 100, opacity: 0.04, delay: 600 },
  { x: width - 40, y: height * 0.4, size: 130, opacity: 0.06, delay: 300 },
  { x: width * 0.3, y: height * 0.55, size: 80, opacity: 0.05, delay: 500 },
  { x: -20, y: height * 0.65, size: 110, opacity: 0.07, delay: 100 },
  { x: width * 0.7, y: height * 0.7, size: 95, opacity: 0.04, delay: 700 },
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

  const animatedOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [opacity * 0.4, opacity],
  });

  return (
    <Animated.View
      style={[
        styles.hexShape,
        {
          left: x,
          top: y,
          width: size,
          height: size * 0.866,
          borderColor: PALETTE.text,
          opacity: animatedOpacity,
        },
      ]}
    />
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const signIn = useUserStore((s) => s.signIn);
  const ensureUser = useUserStore((s) => s.ensureUser);
  const [loading, setLoading] = useState<'google' | 'apple' | 'guest' | null>(null);
  const [showUsernameSheet, setShowUsernameSheet] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  // null = guest flow; string = OAuth userId to pass to signIn
  const pendingUserIdRef = useRef<string | null>(null);
  const sheetAnim = useRef(new Animated.Value(300)).current;
  const sheetBackdrop = useRef(new Animated.Value(0)).current;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

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

    const userId = pendingUserIdRef.current;
    closeUsernameSheet();
    setLoading(userId ? (userId.startsWith('apple_') ? 'apple' : 'google') : 'guest');
    try {
      if (userId) {
        await signIn(userId, trimmed);
      } else {
        await ensureUser(trimmed);
      }
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Error', 'Could not complete sign-in. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSuccess = async (accessToken: string) => {
    try {
      setLoading('google');
      const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const googleUser = await res.json() as { id: string; name?: string; email?: string };
      const suggested = googleUser.name ?? googleUser.email?.split('@')[0] ?? '';
      setLoading(null);
      openUsernameSheet(`google_${googleUser.id}`, suggested);
    } catch {
      Alert.alert('Sign-in failed', 'Could not complete Google sign-in. Please try again.');
      setLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    if (GOOGLE_WEB_CLIENT_ID === 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com') {
      Alert.alert(
        'Google Sign-In',
        'Configure your Google OAuth client IDs in app/welcome.tsx to enable Google sign-in.',
        [{ text: 'OK' }],
      );
      return;
    }
    setLoading('google');
    try {
      await promptGoogleAsync();
    } finally {
      setLoading(null);
    }
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
      const firstName = credential.fullName?.givenName;
      const lastName = credential.fullName?.familyName;
      const suggested =
        firstName && lastName
          ? `${firstName}${lastName}`
          : firstName ?? credential.email?.split('@')[0] ?? '';
      setLoading(null);
      openUsernameSheet(`apple_${credential.user}`, suggested);
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign-in failed', 'Could not complete Apple sign-in. Please try again.');
      }
      setLoading(null);
    }
  };

  const handleGuest = () => openUsernameSheet(null, '');

  const isLoading = loading !== null;

  return (
    <View style={styles.root}>
      {/* Gradient background */}
      <LinearGradient
        colors={['#0A0A14', '#000000', '#0A0610']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Animated hexagon grid */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {HEX_POSITIONS.map((hex, i) => (
          <HexShape key={i} {...hex} />
        ))}
      </View>

      <SafeAreaView style={styles.safe}>
        {/* Hero content */}
        <Animated.View
          style={[
            styles.hero,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}>
          <View style={styles.logoWrap}>
            <View style={styles.logoHex}>
              <Text style={styles.logoHexText}>⬡</Text>
            </View>
          </View>

          <Text style={styles.appName}>HYPERFIT</Text>
          <Text style={styles.tagline}>Claim Your Territory</Text>
          <Text style={styles.sub}>
            Walk and run to capture hexagonal tiles on the real-world map.{'\n'}
            Build your empire. Defend it.
          </Text>
        </Animated.View>

        {/* Auth buttons */}
        <Animated.View
          style={[
            styles.authSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}>
          {/* Apple Sign In — iOS only */}
          {Platform.OS === 'ios' && (
            <Pressable
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.buttonPressed,
                isLoading && loading !== 'apple' && styles.buttonDisabled,
              ]}
              onPress={handleAppleSignIn}
              disabled={isLoading}>
              <Ionicons name="logo-apple" size={20} color="#000" />
              <Text style={styles.googleButtonText}>
                {loading === 'apple' ? 'Signing in…' : 'Sign in with Apple'}
              </Text>
            </Pressable>
          )}

          {/* Google Sign In */}
          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.buttonPressed,
              isLoading && loading !== 'google' && styles.buttonDisabled,
            ]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}>
            <View style={styles.googleIconWrap}>
              <Text style={styles.googleIconText}>G</Text>
            </View>
            <Text style={styles.googleButtonText}>
              {loading === 'google' ? 'Signing in…' : 'Continue with Google'}
            </Text>
          </Pressable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Guest */}
          <Pressable
            style={({ pressed }) => [
              styles.guestButton,
              pressed && styles.buttonPressed,
              isLoading && loading !== 'guest' && styles.buttonDisabled,
            ]}
            onPress={handleGuest}
            disabled={isLoading}>
            <Text style={styles.guestButtonText}>
              {loading === 'guest' ? 'Setting up…' : 'Continue as Guest'}
            </Text>
          </Pressable>

          <Text style={styles.legal}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </Animated.View>
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
  safe: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 20 },

  // Hex background shape
  hexShape: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 4,
    transform: [{ rotate: '30deg' }],
  },

  // Hero section
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  logoWrap: {
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoHex: {
    width: 88,
    height: 88,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  logoHexText: {
    fontSize: 48,
    lineHeight: 56,
  },
  appName: {
    fontSize: 52,
    fontWeight: '800',
    color: PALETTE.text,
    letterSpacing: 12,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    fontWeight: '400',
    color: PALETTE.textMuted,
    letterSpacing: 4,
    textAlign: 'center',
    marginTop: 10,
    textTransform: 'uppercase',
  },
  sub: {
    fontSize: 14,
    color: PALETTE.textDim,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 24,
    maxWidth: 300,
  },

  // Auth section
  authSection: {
    gap: 12,
    paddingTop: 8,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 56,
    gap: 12,
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
  googleButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: PALETTE.border,
  },
  dividerText: {
    color: PALETTE.textDim,
    fontSize: 13,
    fontWeight: '500',
  },
  guestButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    height: 54,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.borderLight,
    backgroundColor: 'transparent',
  },
  guestButtonText: {
    color: PALETTE.textMuted,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  buttonPressed: { opacity: 0.75 },
  buttonDisabled: { opacity: 0.4 },
  legal: {
    color: PALETTE.textDim,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },

  // Username sheet
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    backgroundColor: '#0D0D14',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
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
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 22,
  },
  sheetInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: '#fff',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sheetInputError: {
    borderColor: 'rgba(248,113,113,0.6)',
  },
  sheetError: {
    color: 'rgba(248,113,113,0.85)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    marginLeft: 4,
  },
  sheetHint: {
    color: 'rgba(255,255,255,0.25)',
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
