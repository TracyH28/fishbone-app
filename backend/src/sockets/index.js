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
        }
      }
    });

    // Facilitator advances stage — broadcast to all in session
    socket.on("stage:advance", async ({ sessionId, stage }) => {
      await pool.query("UPDATE sessions SET stage = $1 WHERE id = $2", [stage, sessionId]);
      io.to(`session:${sessionId}`).emit("stage:changed", { stage });
    });
  });
}
