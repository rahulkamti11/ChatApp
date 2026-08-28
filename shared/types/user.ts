export interface User {
  id: string;
  virtualNumber: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  statusBio: string;
  showVirtualNumber: boolean;
  showLastSeen: boolean;
  showReadReceipts: boolean;
  cloudSyncEnabled: boolean;
  isOnline: boolean;
  lastSeenAt: string;
  createdAt: string;
}

export interface UserProfileUpdate {
  displayName?: string;
  statusBio?: string;
  avatarUrl?: string;
  showVirtualNumber?: boolean;
  showLastSeen?: boolean;
  showReadReceipts?: boolean;
  cloudSyncEnabled?: boolean;
}
