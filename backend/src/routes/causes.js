import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireParticipant, requireFacilitator } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

// Participant: submit a cause
router.post("/", requireParticipant, async (req, res) => {
  const { category_id, description, cause_type } = req.body;
  if (!category_id || !description || !cause_type)
    return res.status(400).json({ error: "category_id, description, cause_type required" });
  if (!["lesson_learned", "new_project_approach"].includes(cause_type))
    return res.status(400).json({ error: "Invalid cause_type" });
  if (req.participant.session_id !== parseInt(req.params.sessionId))
    return res.status(403).json({ error: "Not your session" });

  const { rows } = await pool.query(
    `INSERT INTO causes (session_id, category_id, participant_id, description, cause_type)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.sessionId, category_id, req.participant.id, description.trim(), cause_type]
  );
  const { rows: [full] } = await pool.query(
    `SELECT c.*, p.display_name as participant_name,
            cat.name as category_name, cat.colour as category_colour
     FROM causes c
     LEFT JOIN participants p ON p.id = c.participant_id
     LEFT JOIN categories cat ON cat.id = c.category_id
     WHERE c.id = $1`, [rows[0].id]
  );
  // emit via socket (attached to req.app)
  req.app.get("io").to(`session:${req.params.sessionId}`).emit("cause:added", full);
  res.status(201).json(full);
});

// Participant: vote for a cause (stage 2)
router.post("/:causeId/vote", requireParticipant, async (req, res) => {
  const { causeId } = req.params;
  try {
    await pool.query(
      "INSERT INTO cause_votes (cause_id, participant_id) VALUES ($1,$2)",
      [causeId, req.participant.id]
    );
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Already voted" });
    throw err;
  }
  const { rows: [{ count }] } = await pool.query(
    "SELECT COUNT(*) as count FROM cause_votes WHERE cause_id = $1", [causeId]
  );
  req.app.get("io").to(`session:${req.params.sessionId}`).emit("cause:voted", {
    cause_id: parseInt(causeId), vote_count: parseInt(count)
  });
  res.json({ vote_count: parseInt(count) });
});

// Participant: remove vote
router.delete("/:causeId/vote", requireParticipant, async (req, res) => {
  await pool.query(
    "DELETE FROM cause_votes WHERE cause_id = $1 AND participant_id = $2",
    [req.params.causeId, req.participant.id]
  );
  const { rows: [{ count }] } = await pool.query(
    "SELECT COUNT(*) as count FROM cause_votes WHERE cause_id = $1", [req.params.causeId]
  );
  req.app.get("io").to(`session:${req.params.sessionId}`).emit("cause:voted", {
    cause_id: parseInt(req.params.causeId), vote_count: parseInt(count)
  });
  res.json({ vote_count: parseInt(count) });
});

// Facilitator: select/reject causes (stage 2)
router.patch("/:causeId/select", requireFacilitator, async (req, res) => {
  const { selected, dismissal_reason } = req.body;
  // Only keep a reason when dismissing; clear it on select or un-dismiss
  const reason = selected === false ? (dismissal_reason ?? null) : null;
  const { rows } = await pool.query(
    "UPDATE causes SET selected = $1, dismissal_reason = $2 WHERE id = $3 AND session_id = $4 RETURNING *",
    [selected, reason, req.params.causeId, req.params.sessionId]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  req.app.get("io").to(`session:${req.params.sessionId}`).emit("cause:selected", {
    cause_id: rows[0].id, selected: rows[0].selected, dismissal_reason: rows[0].dismissal_reason
  });
  res.json(rows[0]);
});

// Facilitator: update dismissal reason for an already-dismissed cause
router.patch("/:causeId/dismissal-reason", requireFacilitator, async (req, res) => {
  const { dismissal_reason } = req.body;
  const { rows } = await pool.query(
    "UPDATE causes SET dismissal_reason = $1 WHERE id = $2 AND session_id = $3 AND selected = false RETURNING *",
    [dismissal_reason || null, req.params.causeId, req.params.sessionId]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found or cause is not dismissed" });
  req.app.get("io").to(`session:${req.params.sessionId}`).emit("cause:dismissal-reason", {
    cause_id: rows[0].id, dismissal_reason: rows[0].dismissal_reason
  });
  res.json(rows[0]);
});

// Participant: submit risk rating (stage 3 or 5)
router.post("/:causeId/rating", requireParticipant, async (req, res) => {
  const { stage, rating } = req.body;
  if (![3, 5].includes(stage)) return res.status(400).json({ error: "stage must be 3 or 5" });
  if (!["high", "medium", "low"].includes(rating))
    return res.status(400).json({ error: "rating must be high, medium, or low" });

  await pool.query(
    `INSERT INTO risk_ratings (cause_id, participant_id, stage, rating)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (cause_id, participant_id, stage) DO UPDATE SET rating = $4, rated_at = NOW()`,
    [req.params.causeId, req.participant.id, stage, rating]
  );
  const { rows: allRatings } = await pool.query(
    "SELECT rating FROM risk_ratings WHERE cause_id = $1 AND stage = $2",
    [req.params.causeId, stage]
  );
  req.app.get("io").to(`session:${req.params.sessionId}`).emit("cause:rated", {
    cause_id: parseInt(req.params.causeId), stage, ratings: allRatings.map(r => r.rating)
  });
  res.json({ ok: true });
});

// Participant or facilitator: add a note to a cause
router.post("/:causeId/notes", async (req, res) => {
  // Accept either participant or facilitator token
  const { content, participant_name } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: "content required" });
  if (!participant_name || !participant_name.trim()) return res.status(400).json({ error: "participant_name required" });

  const { rows } = await pool.query(
    `INSERT INTO cause_notes (cause_id, participant_name, content)
     VALUES ($1,$2,$3) RETURNING *`,
    [req.params.causeId, participant_name.trim(), content.trim()]
  );
  const note = rows[0];
  req.app.get("io").to(`session:${req.params.sessionId}`).emit("note:added", note);
  res.status(201).json(note);
});

// Facilitator: set final risk rating (stage 3 or 5)
router.post("/:causeId/rating/final", requireFacilitator, async (req, res) => {
  const { stage, rating } = req.body;
  if (![3, 5].includes(stage)) return res.status(400).json({ error: "stage must be 3 or 5" });
  if (!["high", "medium", "low"].includes(rating))
    return res.status(400).json({ error: "rating must be high, medium, or low" });

  if (stage === 3) {
    const { rows } = await pool.query(
      `INSERT INTO risk_finals (cause_id, stage, rating)
       VALUES ($1,$2,$3)
       ON CONFLICT (cause_id) DO UPDATE SET stage=$2, rating=$3, set_at=NOW()
       RETURNING *`,
      [req.params.causeId, stage, rating]
    );
    req.app.get("io").to(`session:${req.params.sessionId}`).emit("risk:final", {
      cause_id: parseInt(req.params.causeId), stage, rating: rows[0].rating
    });
    return res.json(rows[0]);
  } else {
    const { rows } = await pool.query(
      `INSERT INTO residual_risk_finals (cause_id, rating)
       VALUES ($1,$2)
       ON CONFLICT (cause_id) DO UPDATE SET rating=$2, set_at=NOW()
       RETURNING *`,
      [req.params.causeId, rating]
    );
    req.app.get("io").to(`session:${req.params.sessionId}`).emit("residual:final", {
      cause_id: parseInt(req.params.causeId), rating: rows[0].rating
    });
    return res.json(rows[0]);
  }
});

export default router;
