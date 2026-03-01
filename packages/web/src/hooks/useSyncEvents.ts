import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSyncEventsOptions {
  projectGroupId?: string;
  onSyncStarted?: (data: any) => void;
  onSyncProgress?: (data: any) => void;
  onSyncCompleted?: (data: any) => void;
  onSyncFailed?: (data: any) => void;
  onReviewPending?: (data: any) => void;
}

export function useSyncEvents(options: UseSyncEventsOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io('/ws/sync-events', {
      query: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    if (options.onSyncStarted) socket.on('sync:started', options.onSyncStarted);
    if (options.onSyncProgress) socket.on('sync:progress', options.onSyncProgress);
    if (options.onSyncCompleted) socket.on('sync:completed', options.onSyncCompleted);
    if (options.onSyncFailed) socket.on('sync:failed', options.onSyncFailed);
    if (options.onReviewPending) socket.on('review:pending', options.onReviewPending);

    socketRef.current = socket;
  }, []);

  const subscribe = useCallback((projectGroupId: string) => {
    socketRef.current?.emit('subscribe', { projectGroupId });
  }, []);

  const unsubscribe = useCallback((projectGroupId: string) => {
    socketRef.current?.emit('unsubscribe', { projectGroupId });
  }, []);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  useEffect(() => {
    if (connected && options.projectGroupId) {
      subscribe(options.projectGroupId);
      return () => { unsubscribe(options.projectGroupId!); };
    }
  }, [connected, options.projectGroupId, subscribe, unsubscribe]);

  return { connected, subscribe, unsubscribe };
}
