import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { ApiUser, api } from '../services/api';

const USER_ID_KEY = 'mates_user_id';
const JWT_KEY = 'mates_jwt';
const ONBOARDED_KEY = 'mates_onboarded';

interface UserState {
  user: ApiUser | null;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  hasSeenOnboarding: boolean;

  setUser: (user: ApiUser) => void;
  checkStoredAuth: () => Promise<void>;
  loginOAuth: (userId: string) => Promise<{ isNew: boolean }>;
  registerUser: (userId: string, username: string) => Promise<ApiUser>;
  signOut: () => Promise<void>;
  markOnboardingDone: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isCheckingAuth: true,
  hasSeenOnboarding: false,

  setUser: (user) => set({ user }),

  checkStoredAuth: async () => {
    try {
      const [token, onboarded] = await Promise.all([
        SecureStore.getItemAsync(JWT_KEY),
        SecureStore.getItemAsync(ONBOARDED_KEY),
      ]);
      const hasSeenOnboarding = onboarded === 'true';
      if (token) {
        const { user } = await api.verifyToken(token);
        set({ user, isAuthenticated: true, isCheckingAuth: false, hasSeenOnboarding });
      } else {
        set({ isCheckingAuth: false, hasSeenOnboarding });
      }
    } catch {
      await SecureStore.deleteItemAsync(JWT_KEY);
      set({ isCheckingAuth: false });
    }
  },

  loginOAuth: async (userId: string) => {
    const result = await api.login(userId);
    if (!result.isNew && result.token && result.user) {
      await SecureStore.setItemAsync(JWT_KEY, result.token);
      await SecureStore.setItemAsync(USER_ID_KEY, result.user.id);
      set({ user: result.user, isAuthenticated: true });
    }
    return { isNew: result.isNew };
  },

  registerUser: async (userId: string, username: string) => {
    const { token, user } = await api.register(userId, username);
    await SecureStore.setItemAsync(JWT_KEY, token);
    await SecureStore.setItemAsync(USER_ID_KEY, user.id);
    set({ user, isAuthenticated: true });
    return user;
  },

  signOut: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(JWT_KEY),
      SecureStore.deleteItemAsync(USER_ID_KEY),
      SecureStore.deleteItemAsync(ONBOARDED_KEY),
    ]);
    set({ user: null, isAuthenticated: false, hasSeenOnboarding: false });
  },

  markOnboardingDone: async () => {
    await SecureStore.setItemAsync(ONBOARDED_KEY, 'true');
    set({ hasSeenOnboarding: true });
  },

  refreshUser: async () => {
    const current = get().user;
    if (!current) return;
    const { user } = await api.getUser(current.id);
    set({ user });
  },
}));
