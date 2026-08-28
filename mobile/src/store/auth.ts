import { create } from 'zustand';

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
  setAuth: (token: string, user: UserState) => void;
  updateUser: (fields: Partial<UserState>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
  updateUser: (fields) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...fields } : null,
    })),
  logout: () => set({ token: null, user: null, isAuthenticated: false }),
}));
