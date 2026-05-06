import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { OnboardingGuide } from '@/src/components/OnboardingGuide';
import { PALETTE } from '@/src/constants/game';
import { useUserStore } from '@/src/store/userStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

const NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: PALETTE.background,
    card: PALETTE.surface,
    border: PALETTE.border,
    text: PALETTE.text,
    primary: PALETTE.primary,
  },
};

function AuthGuard() {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const isCheckingAuth = useUserStore((s) => s.isCheckingAuth);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isCheckingAuth) return;

    const onWelcome = segments[0] === 'welcome';

    if (!isAuthenticated && !onWelcome) {
      router.replace('/welcome');
    } else if (isAuthenticated && onWelcome) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isCheckingAuth, segments, router]);

  return null;
}

function OnboardingLayer() {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const hasSeenOnboarding = useUserStore((s) => s.hasSeenOnboarding);
  const markOnboardingDone = useUserStore((s) => s.markOnboardingDone);
  const [show, setShow] = useState(false);

  // Show guide once authenticated and not yet seen
  useEffect(() => {
    if (isAuthenticated && !hasSeenOnboarding) {
      // Small delay so the map has time to render underneath
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated, hasSeenOnboarding]);

  if (!show) return null;

  return (
    <OnboardingGuide
      onDone={() => {
        setShow(false);
        markOnboardingDone();
      }}
    />
  );
}

export default function RootLayout() {
  const checkStoredAuth = useUserStore((s) => s.checkStoredAuth);
  const isCheckingAuth = useUserStore((s) => s.isCheckingAuth);

  useEffect(() => {
    checkStoredAuth();
  }, [checkStoredAuth]);

  if (isCheckingAuth) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: PALETTE.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator color={PALETTE.text} size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={NavTheme}>
      <AuthGuard />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen
          name="run-detail"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="run-summary"
          options={{
            presentation: 'modal',
            title: 'Run Summary',
            headerStyle: { backgroundColor: PALETTE.background },
            headerTintColor: PALETTE.text,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
      </Stack>
      <OnboardingLayer />
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
