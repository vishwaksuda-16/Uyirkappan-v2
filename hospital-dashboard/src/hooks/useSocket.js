import { useState, useEffect, useCallback } from 'react';
import socketService from '../services/socketService';

export function useSocket() {
  const [status, setStatus] = useState(socketService.status);

  useEffect(() => {
    const unsubscribe = socketService.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    return () => unsubscribe();
  }, []);

  const reconnect = useCallback(() => {
    socketService.disconnect();
    const token = localStorage.getItem('uyirkappan_token');
    socketService.connect(token);
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    isReconnecting: status === 'reconnecting',
    isDisconnected: status === 'disconnected',
    reconnect,
  };
}

export default useSocket;
