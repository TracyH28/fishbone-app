import { Router } from "express";
import { pool } from "../db/pool.js";
import { generateSessionPDF } from "../services/pdf.js";

const router = Router({ mergeParams: true });

// Public report data — used by the summary page and PDF renderer
router.get("/:sessionId/report", async (req, res) => {
  const id = req.params.sessionId;
  const { rows: [session] } = await pool.query("SELECT * FROM sessions WHERE id = $1", [id]);
  if (!session) return res.status(404).json({ error: "Not found" });

  const { rows: categories } = await pool.query(
    "SELECT * FROM categories WHERE session_id = $1 ORDER BY display_order", [id]
  );
  const { rows: causes } = await pool.query(
    `SELECT c.*, p.display_name as participant_name,
            cat.name as category_name, cat.colour as category_colour
     FROM causes c
     LEFT JOIN participants p ON p.id = c.participant_id
     LEFT JOIN categories cat ON cat.id = c.category_id
     WHERE c.session_id = $1 ORDER BY c.created_at`, [id]
  );
  const causeIds = causes.map(c => c.id);
  const { rows: voteCounts } = await pool.query(
    `SELECT cause_id, COUNT(*) as count FROM cause_votes
     WHERE cause_id = ANY($1::int[]) GROUP BY cause_id`,
    [causeIds]
  );
  const { rows: riskFinals } = await pool.query(
    "SELECT * FROM risk_finals WHERE cause_id = ANY($1::int[])", [causeIds]
  );
  const { rows: actions } = await pool.query(
    "SELECT * FROM actions WHERE cause_id = ANY($1::int[]) ORDER BY created_at", [causeIds]
  );
  const { rows: residualFinals } = await pool.query(
    "SELECT * FROM residual_risk_finals WHERE cause_id = ANY($1::int[])", [causeIds]
  );
  const { rows: participants } = await pool.query(
    "SELECT id, display_name, joined_at FROM participants WHERE session_id = $1", [id]
  );

  res.json({ session, categories, causes, voteCounts, riskFinals, actions, residualFinals, participants });
});

// PDF download
router.get("/:sessionId/pdf", async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const url = `${frontendUrl}/report/${req.params.sessionId}?print=1`;
  try {
    const pdf = await generateSessionPDF(url);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="session-${req.params.sessionId}-report.pdf"`,
    });
    res.send(pdf);
  } catch (err) {
    console.error("PDF generation failed:", err);
    res.status(500).json({ error: "PDF generation failed" });
  }
});

// Facilitator: get full session data including all ratings
router.get("/:sessionId/full", async (req, res) => {
  const id = req.params.sessionId;
  const { rows: [session] } = await pool.query("SELECT * FROM sessions WHERE id = $1", [id]);
  if (!session) return res.status(404).json({ error: "Not found" });

  const { rows: categories } = await pool.query(
    "SELECT * FROM categories WHERE session_id = $1 ORDER BY display_order", [id]
  );
  const { rows: causes } = await pool.query(
    `SELECT c.*, p.display_name as participant_name,
            cat.name as category_name, cat.colour as category_colour
     FROM causes c
     LEFT JOIN participants p ON p.id = c.participant_id
     LEFT JOIN categories cat ON cat.id = c.category_id
     WHERE c.session_id = $1 ORDER BY c.created_at`, [id]
  );
  const causeIds = causes.map(c => c.id);
  const { rows: votes } = await pool.query(
    `SELECT cause_id, COUNT(*) as count FROM cause_votes
     WHERE cause_id = ANY($1::int[]) GROUP BY cause_id`, [causeIds]
  );
  const { rows: ratings } = await pool.query(
    "SELECT * FROM risk_ratings WHERE cause_id = ANY($1::int[]) ORDER BY stage, cause_id", [causeIds]
  );
  const { rows: riskFinals } = await pool.query(
    "SELECT * FROM risk_finals WHERE cause_id = ANY($1::int[])", [causeIds]
  );
  const { rows: actions } = await pool.query(
    "SELECT * FROM actions WHERE cause_id = ANY($1::int[]) ORDER BY created_at", [causeIds]
  );
  const { rows: residualFinals } = await pool.query(
    "SELECT * FROM residual_risk_finals WHERE cause_id = ANY($1::int[])", [causeIds]
  );
  const { rows: participants } = await pool.query(
    "SELECT id, display_name, joined_at FROM participants WHERE session_id = $1", [id]
  );

  res.json({ session, categories, causes, votes, ratings, riskFinals, actions, residualFinals, participants });
});

export default router;
