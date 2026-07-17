import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { readEnv } from './env.js';

const SOCKET_URL = readEnv('VITE_SOCKET_URL', 'http://localhost:3000');

export const useOrderUpdates = (): boolean => {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('wct_access_token');
    if (!token) return;
    const socket = io(`${SOCKET_URL}/operations`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });
    const onConnect = (): void => {
      setConnected(true);
    };
    const onDisconnect = (): void => {
      setConnected(false);
    };
    const onOrderUpdated = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('order.updated', onOrderUpdated);
    return (): void => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('order.updated', onOrderUpdated);
      socket.disconnect();
    };
  }, [queryClient]);

  return connected;
};
