import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Shared Socket.IO connection.
 * Connects to the SAME origin the app was served from (Vite proxies /socket.io
 * to Express in dev). Auth uses the HTTP-only cookie sent with the handshake.
 */
let sharedSocket = null;
let refCount = 0;

export function useSocket(enabled = true) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    if (!sharedSocket) {
      sharedSocket = io({
        path: '/socket.io',
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 8,
        reconnectionDelay: 800,
      });
    }
    refCount += 1;
    socketRef.current = sharedSocket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    sharedSocket.on('connect', onConnect);
    sharedSocket.on('disconnect', onDisconnect);
    if (sharedSocket.connected) setConnected(true);

    return () => {
      sharedSocket?.off('connect', onConnect);
      sharedSocket?.off('disconnect', onDisconnect);
      refCount -= 1;
      if (refCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        refCount = 0;
      }
    };
  }, [enabled]);

  /** Promise-based emit with server ack. */
  const emit = useCallback((event, payload) => {
    return new Promise((resolve) => {
      if (!socketRef.current?.connected) {
        resolve({ error: 'Not connected to the live server' });
        return;
      }
      const timer = setTimeout(() => resolve({ error: 'Request timed out' }), 8000);
      socketRef.current.emit(event, payload, (ack) => {
        clearTimeout(timer);
        resolve(ack || { ok: true });
      });
    });
  }, []);

  /** Subscribe to an event, auto-cleaned on unmount. */
  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return { socket: socketRef.current, connected, emit, on };
}

/** Subscribe to a socket event for the lifetime of a component. */
export function useSocketEvent(socket, event, handler, deps = []) {
  useEffect(() => {
    if (!socket) return undefined;
    socket.on(event, handler);
    return () => socket.off(event, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, event, ...deps]);
}
