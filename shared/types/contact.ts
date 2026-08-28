export interface Contact {
  id: string;
  ownerUserId: string;
  contactUserId: string;
  customName: string | null;
  isBlocked: boolean;
  isMuted: boolean;
  displayName: string;
  username: string | null;
  virtualNumber: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
  createdAt: string;
}
