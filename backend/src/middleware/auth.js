import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";

export function requireFacilitator(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.facilitatorId = payload.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export async function requireParticipant(req, res, next) {
  const token = req.headers["x-participant-token"];
  if (!token) return res.status(401).json({ error: "Participant token required" });
  const { rows } = await pool.query(
    "SELECT * FROM participants WHERE token = $1",
    [token]
  );
  if (!rows.length) return res.status(401).json({ error: "Invalid participant token" });
  req.participant = rows[0];
  next();
}

export async function requireSession(req, res, next) {
  const id = req.params.sessionId || req.body.sessionId;
  const { rows } = await pool.query("SELECT * FROM sessions WHERE id = $1", [id]);
  if (!rows.length) return res.status(404).json({ error: "Session not found" });
  req.session = rows[0];
  next();
}
