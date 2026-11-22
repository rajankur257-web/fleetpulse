import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://127.0.0.1:4000';
export const DEFAULT_DISPATCHER_TOKEN =
  process.env.NEXT_PUBLIC_DISPATCHER_TOKEN ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaXNwYXRjaGVyLWFkbWluIiwicm9sZSI6ImRpc3BhdGNoZXIiLCJuYW1lIjoiTGVhZCBEaXNwYXRjaGVyIiwiaWF0IjoxNzk1MzY2NjE4LCJleHAiOjE4MjY5MDI2MTh9.1Bktw0BajjH8tsQhuditSOCIKkZdeow3ZEPhZtaKXP0';

let socket: Socket | null = null;

export function getSocket(token = DEFAULT_DISPATCHER_TOKEN): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket'],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
