import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = 'https://api.loremanga.com';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { authToken, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  // 未読メッセージのある会話ID Set
  const [unreadConvIds, setUnreadConvIds] = useState(new Set());
  // グローバルな新着メッセージハンドラ（ChatScreenが登録する）
  const messageHandlerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !authToken) {
      // ログアウト時は切断
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('new_message', (data) => {
      const { conversation_id, message } = data;
      // ChatScreenが開いていればそちらに転送
      if (messageHandlerRef.current) {
        messageHandlerRef.current(conversation_id, message);
      }
      // タブバッジ用に未読会話IDを追加
      setUnreadConvIds(prev => new Set([...prev, conversation_id]));
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, authToken]);

  const registerMessageHandler = useCallback((handler) => {
    messageHandlerRef.current = handler;
    return () => { messageHandlerRef.current = null; };
  }, []);

  const clearUnread = useCallback((convId) => {
    setUnreadConvIds(prev => {
      const next = new Set(prev);
      next.delete(convId);
      return next;
    });
  }, []);

  const clearAllUnread = useCallback(() => {
    setUnreadConvIds(new Set());
  }, []);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      unreadConvIds,
      registerMessageHandler,
      clearUnread,
      clearAllUnread,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
