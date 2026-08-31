import { create } from 'zustand';
import { getLocalDatabase } from '../db/client';

export interface UserState {
  id: string;
  virtualNumber: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  statusBio: string;
  showVirtualNumber: boolean;
  cloudSyncEnabled: boolean;
}

interface AuthStore {
  token: string | null;
  user: UserState | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setAuth: (token: string, user: UserState) => void;
  updateUser: (fields: Partial<UserState>) => void;
  logout: () => void;
  hydrateAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  setAuth: (token, user) => {
    set({ token, user, isAuthenticated: true });
    getLocalDatabase().then((db) => {
      db.runAsync(
        'INSERT OR REPLACE INTO local_settings (key, value) VALUES (?, ?), (?, ?)',
        ['auth_token', token, 'auth_user', JSON.stringify(user)]
      ).catch((err) => console.error('[SQLite] Failed to persist auth session:', err));
    });
  },
  updateUser: (fields) => {
    const updatedUser = get().user ? { ...get().user!, ...fields } : null;
    set({ user: updatedUser });
    if (updatedUser) {
      getLocalDatabase().then((db) => {
        db.runAsync(
          'INSERT OR REPLACE INTO local_settings (key, value) VALUES (?, ?)',
          ['auth_user', JSON.stringify(updatedUser)]
        ).catch((err) => console.error('[SQLite] Failed to persist user update:', err));
      });
    }
  },
  logout: () => {
    set({ token: null, user: null, isAuthenticated: false });
    getLocalDatabase().then((db) => {
      db.runAsync(
        "DELETE FROM local_settings WHERE key IN ('auth_token', 'auth_user')"
      ).catch((err) => console.error('[SQLite] Failed to clear auth session:', err));
    });
  },
  hydrateAuth: async () => {
    try {
      const db = await getLocalDatabase();
      const rows = await db.getAllAsync<{ key: string; value: string }>(
        "SELECT key, value FROM local_settings WHERE key IN ('auth_token', 'auth_user')"
      );
      let token: string | null = null;
      let user: UserState | null = null;
      for (const row of rows) {
        if (row.key === 'auth_token') token = row.value;
        if (row.key === 'auth_user') {
          try {
            user = JSON.parse(row.value);
          } catch (e) {}
        }
      }
      if (token && user) {
        set({ token, user, isAuthenticated: true, isHydrated: true });
        return true;
      }
    } catch (err) {
      console.error('[SQLite] Failed to hydrate auth session:', err);
    }
    set({ isHydrated: true });
    return false;
  },
}));

