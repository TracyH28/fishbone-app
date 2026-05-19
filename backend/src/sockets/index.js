import { pool } from "../db/pool.js";

export function registerSockets(io) {
  io.on("connection", (socket) => {
    socket.on("join:session", async ({ sessionId, token, isFacilitator }) => {
      if (isFacilitator) {
        socket.join(`session:${sessionId}`);
        socket.join(`facilitator:${sessionId}`);
      } else {
        const { rows } = await pool.query(
          "SELECT * FROM participants WHERE token = $1 AND session_id = $2",
          [token, sessionId]
        );
        if (rows.length) {
          socket.join(`session:${sessionId}`);
          socket.data.participantId = rows[0].id;
          socket.data.participantName = rows[0].display_name;
          socket.data.sessionId = sessionId;
          // Notify facilitator that this participant is online
          io.to(`facilitator:${sessionId}`).emit("participant:online", {
            display_name: rows[0].display_name,
          });
        }
      }
    });

    // Facilitator advances stage — broadcast to all in session
    socket.on("stage:advance", async ({ sessionId, stage }) => {
      await pool.query("UPDATE sessions SET stage = $1 WHERE id = $2", [stage, sessionId]);
      io.to(`session:${sessionId}`).emit("stage:changed", { stage });
    });

    // When participant disconnects, notify facilitator
    socket.on("disconnect", () => {
      if (socket.data.participantName && socket.data.sessionId) {
        io.to(`facilitator:${socket.data.sessionId}`).emit("participant:offline", {
          display_name: socket.data.participantName,
        });
      }
    });
  });
}
