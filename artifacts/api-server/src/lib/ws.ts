import { WebSocket } from "ws";

// Map from DB user ID → WebSocket connection
const connections = new Map<number, WebSocket>();

export function registerConnection(userId: number, ws: WebSocket) {
  connections.set(userId, ws);
}

export function removeConnection(userId: number) {
  connections.delete(userId);
}

export function sendToUser(userId: number, event: object) {
  const ws = connections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

export function isUserOnline(userId: number): boolean {
  const ws = connections.get(userId);
  return ws !== undefined && ws.readyState === WebSocket.OPEN;
}
