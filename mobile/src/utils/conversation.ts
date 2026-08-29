export function getDirectConversationId(userIdA: string, userIdB: string): string {
  const sorted = [userIdA, userIdB].sort();
  return `conv_${sorted[0]}_${sorted[1]}`;
}
