import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:4000";

export function useSocket(
  sessionId: number | null,
  opts: { token?: string; isFacilitator?: boolean },
  handlers: Record<string, (data: unknown) => void>
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const socket = io(WS_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join:session", {
        sessionId,
        token: opts.token,
        isFacilitator: opts.isFacilitator ?? false,
      });
    });

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    return () => { socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return socketRef;
}
