import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;

function getSocket() {
  if (!socket) {
    socket = io({ withCredentials: true });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function useSocket(events) {
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    const s = getSocket();

    const handlers = {};
    for (const [event, handler] of Object.entries(eventsRef.current)) {
      handlers[event] = (...args) => eventsRef.current[event]?.(...args);
      s.on(event, handlers[event]);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        s.off(event, handler);
      }
    };
  }, []);
}
