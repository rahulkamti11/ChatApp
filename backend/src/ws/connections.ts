export class ConnectionManager {
  private static connections: Map<string, WebSocket> = new Map();

  public static add(userId: string, socket: WebSocket) {
    this.connections.set(userId, socket);
  }

  public static remove(userId: string) {
    this.connections.delete(userId);
  }

  public static get(userId: string): WebSocket | undefined {
    return this.connections.get(userId);
  }

  public static isOnline(userId: string): boolean {
    return this.connections.has(userId);
  }
}
