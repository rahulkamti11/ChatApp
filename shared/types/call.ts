export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'answered' | 'missed' | 'declined' | 'busy' | 'failed';

export interface CallLog {
  id: string;
  callerId: string;
  receiverId: string;
  callType: CallType;
  status: CallStatus;
  durationSeconds: number;
  startedAt: string;
  endedAt: string | null;
}
