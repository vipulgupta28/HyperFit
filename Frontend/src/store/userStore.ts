import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { ApiUser, api } from '../services/api';

const USER_ID_KEY = 'mates_user_id';
const ONBOARDED_KEY = 'mates_onboarded';

interface UserState {
  user: ApiUser | null;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;

  setUser: (user: ApiUser) => void;
  ensureUser: (preferredUsername?: string) => Promise<ApiUser>;
  refreshUser: () => Promise<void>;
  checkStoredAuth: () => Promise<void>;
  signIn: (userId: string, username?: string) => Promise<ApiUser>;
  signOut: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isCheckingAuth: true,

  setUser: (user) => set({ user }),

  checkStoredAuth: async () => {
    try {
      const storedId = await SecureStore.getItemAsync(USER_ID_KEY);
      if (storedId) {
        const { user } = await api.getUser(storedId);
        set({ user, isAuthenticated: true, isCheckingAuth: false });
      } else {
        set({ isCheckingAuth: false });
      }
    } catch {
      set({ isCheckingAuth: false });
    }
  },

  signIn: async (userId: string, username?: string) => {
    const { user } = await api.getUser(userId.length < 30 ? username ?? userId : userId);
    await SecureStore.setItemAsync(USER_ID_KEY, user.id);
    await SecureStore.setItemAsync(ONBOARDED_KEY, 'true');
    set({ user, isAuthenticated: true });
    return user;
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(USER_ID_KEY);
    await SecureStore.deleteItemAsync(ONBOARDED_KEY);
    set({ user: null, isAuthenticated: false });
  },

  ensureUser: async (preferredUsername) => {
    const existing = get().user;
    if (existing) return existing;
    const username = preferredUsername ?? 'Runner';
    const { user } = await api.getUser(username);
    await SecureStore.setItemAsync(USER_ID_KEY, user.id);
    set({ user, isAuthenticated: true });
    return user;
  },

  refreshUser: async () => {
    const current = get().user;
    if (!current) return;
    const { user } = await api.getUser(current.id);
    set({ user });
  },
}));
