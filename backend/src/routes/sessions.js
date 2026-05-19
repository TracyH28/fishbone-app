import { Router } from "express";
import { nanoid } from "nanoid";
import { pool } from "../db/pool.js";
import { requireFacilitator, requireParticipant } from "../middleware/auth.js";

const router = Router();

// Facilitator: list own sessions
router.get("/", requireFacilitator, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM sessions WHERE facilitator_id = $1 ORDER BY created_at DESC",
    [req.facilitatorId]
  );
  res.json(rows);
});

// Facilitator: create session
router.post("/", requireFacilitator, async (req, res) => {
  const { title, project_name, opens_at, closes_at } = req.body;
  if (!title || !project_name) return res.status(400).json({ error: "title and project_name required" });
  const join_code = nanoid(6).toUpperCase();
  const { rows } = await pool.query(
    `INSERT INTO sessions (facilitator_id, title, project_name, join_code, opens_at, closes_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.facilitatorId, title, project_name, join_code, opens_at || null, closes_at || null]
  );
  res.status(201).json(rows[0]);
});

// Facilitator: get single session (full detail)
router.get("/:id", requireFacilitator, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM sessions WHERE id = $1 AND facilitator_id = $2",
    [req.params.id, req.facilitatorId]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// Facilitator: update session metadata or advance stage
router.patch("/:id", requireFacilitator, async (req, res) => {
  const { title, project_name, opens_at, closes_at, stage } = req.body;
  const { rows: existing } = await pool.query(
    "SELECT * FROM sessions WHERE id = $1 AND facilitator_id = $2",
    [req.params.id, req.facilitatorId]
  );
  if (!existing.length) return res.status(404).json({ error: "Not found" });

  const s = existing[0];
  const { rows } = await pool.query(
    `UPDATE sessions SET
       title = $1, project_name = $2, opens_at = $3, closes_at = $4, stage = $5
     WHERE id = $6 RETURNING *`,
    [
      title ?? s.title,
      project_name ?? s.project_name,
      opens_at !== undefined ? opens_at : s.opens_at,
      closes_at !== undefined ? closes_at : s.closes_at,
      stage !== undefined ? stage : s.stage,
      req.params.id,
    ]
  );
  res.json(rows[0]);
});

// Facilitator: delete session (cascades all child data)
router.delete("/:id", requireFacilitator, async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM sessions WHERE id = $1 AND facilitator_id = $2",
    [req.params.id, req.facilitatorId]
  );
  if (!rowCount) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

// Public: join session by code
router.post("/join", async (req, res) => {
  const { join_code, display_name } = req.body;
  if (!join_code || !display_name) return res.status(400).json({ error: "join_code and display_name required" });

  const { rows: sessions } = await pool.query(
    "SELECT * FROM sessions WHERE join_code = $1",
    [join_code.toUpperCase().trim()]
  );
  if (!sessions.length) return res.status(404).json({ error: "Session not found" });

  const session = sessions[0];
  const now = new Date();
  if (session.opens_at && new Date(session.opens_at) > now)
    return res.status(403).json({ error: "Session not yet open" });
  if (session.closes_at && new Date(session.closes_at) < now)
    return res.status(403).json({ error: "Session has closed" });

  const token = nanoid(32);
  const { rows } = await pool.query(
    "INSERT INTO participants (session_id, display_name, token) VALUES ($1,$2,$3) RETURNING *",
    [session.id, display_name.trim(), token]
  );
  res.json({ token: rows[0].token, participant: rows[0], session });
});

// Participant: get session state
router.get("/:id/state", requireParticipant, async (req, res) => {
  const sessionId = req.params.id;
  if (req.participant.session_id !== parseInt(sessionId))
    return res.status(403).json({ error: "Not your session" });

  const { rows: [session] } = await pool.query("SELECT * FROM sessions WHERE id = $1", [sessionId]);
  const { rows: categories } = await pool.query(
    "SELECT * FROM categories WHERE session_id = $1 ORDER BY display_order", [sessionId]
  );
  const { rows: causes } = await pool.query(
    `SELECT c.*, p.display_name as participant_name,
            cat.name as category_name, cat.colour as category_colour,
            COALESCE(v.vote_count, 0)::int as vote_count
     FROM causes c
     LEFT JOIN participants p ON p.id = c.participant_id
     LEFT JOIN categories cat ON cat.id = c.category_id
     LEFT JOIN (
       SELECT cause_id, COUNT(*) as vote_count FROM cause_votes GROUP BY cause_id
     ) v ON v.cause_id = c.id
     WHERE c.session_id = $1 ORDER BY c.created_at`, [sessionId]
  );
  const { rows: votes } = await pool.query(
    "SELECT cause_id FROM cause_votes WHERE participant_id = $1", [req.participant.id]
  );
  const { rows: myRatings } = await pool.query(
    "SELECT * FROM risk_ratings WHERE participant_id = $1", [req.participant.id]
  );
  const { rows: riskFinals } = await pool.query(
    "SELECT * FROM risk_finals WHERE cause_id = ANY($1::int[])",
    [causes.map(c => c.id)]
  );
  const { rows: actions } = await pool.query(
    "SELECT * FROM actions WHERE cause_id = ANY($1::int[]) ORDER BY created_at",
    [causes.map(c => c.id)]
  );
  const { rows: residualFinals } = await pool.query(
    "SELECT * FROM residual_risk_finals WHERE cause_id = ANY($1::int[])",
    [causes.map(c => c.id)]
  );
  const causeIds = causes.map(c => c.id);
  const { rows: notes } = causeIds.length ? await pool.query(
    "SELECT * FROM cause_notes WHERE cause_id = ANY($1::int[]) ORDER BY created_at",
    [causeIds]
  ) : { rows: [] };

  res.json({ session, categories, causes, myVotes: votes.map(v => v.cause_id), myRatings, riskFinals, actions, residualFinals, notes });
});

export default router;
