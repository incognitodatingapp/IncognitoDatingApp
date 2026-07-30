import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/react';

export type WSMessage =
  | { type: 'connected'; userId: number }
  | { type: 'match_found'; match: any }
  | { type: 'new_message'; message: any; senderMsgCount: number }
  | { type: 'chat_ended'; matchId: number }
  | { type: 'reveal_update'; myRevealRequested: boolean; partnerRevealRequested: boolean; isRevealed: boolean };

export function useWebSocket() {
  const { isSignedIn, getToken } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Set<(msg: WSMessage) => void>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    if (!isSignedIn) return;

    try {
      // Fetch the Clerk token so the backend can authenticate the socket connection
      const token = await getToken();
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const backendHost = import.meta.env.PROD ? 'incognitodatingapp.onrender.com' : window.location.host;
      
      // Pass the token as a query parameter (e.g., /api/ws?token=xyz)
      const wsUrl = `${protocol}//${backendHost}/api/ws${token ? `?token=${token}` : ''}`;

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
        reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
      };

      ws.onerror = (err) => {
        console.error('WS Error', err);
        ws.close();
      };

      setSocket(ws);
    } catch (error) {
      console.error('Failed to get auth token for WebSocket', error);
    }
  }, [isSignedIn, getToken]);

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
