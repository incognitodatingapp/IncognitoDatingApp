import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/react';

export type WSMessage =
  | { type: 'connected'; userId: number }
  | { type: 'match_found'; match: any }
  | { type: 'new_message'; message: any; senderMsgCount: number }
  | { type: 'chat_ended'; matchId: number }
  | { type: 'reveal_update'; myRevealRequested: boolean; partnerRevealRequested: boolean; isRevealed: boolean };

export function useWebSocket() {
  const { isSignedIn } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Set<(msg: WSMessage) => void>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!isSignedIn) return;

    // Use current origin and base path to construct ws:// or wss:// URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // The API server is mounted at /api, but the websocket is usually at /api/ws or just /ws. 
    // Wait, the prompt says "Connect to /ws for real-time updates"
// Automatically uses Render in production, or local host if developing locally
const backendHost = import.meta.env.PROD ? 'incognitodatingapp.onrender.com' : window.location.host;
const wsUrl = `${protocol}//${backendHost}/api/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;
        listenersRef.current.forEach(listener => listener(data));
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setSocket(null);
      // Exponential backoff or simple fixed backoff
      reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = (err) => {
      console.error('WS Error', err);
      ws.close();
    };

    setSocket(ws);
  }, [isSignedIn]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socket) socket.close();
    };
  }, [connect]);

  const addListener = useCallback((listener: (msg: WSMessage) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return { isConnected, addListener };
}
