import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireFacilitator } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

router.get("/", requireFacilitator, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM categories WHERE session_id = $1 ORDER BY display_order",
    [req.params.sessionId]
  );
  res.json(rows);
});

router.post("/", requireFacilitator, async (req, res) => {
  const { name, colour } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const { rows: existing } = await pool.query(
    "SELECT COUNT(*) as cnt FROM categories WHERE session_id = $1",
    [req.params.sessionId]
  );
  const order = parseInt(existing[0].cnt);
  const { rows } = await pool.query(
    "INSERT INTO categories (session_id, name, colour, display_order) VALUES ($1,$2,$3,$4) RETURNING *",
    [req.params.sessionId, name.trim(), colour || "#6366f1", order]
  );
  res.status(201).json(rows[0]);
});

router.patch("/:catId", requireFacilitator, async (req, res) => {
  const { name, colour, display_order } = req.body;
  const { rows: existing } = await pool.query(
    "SELECT * FROM categories WHERE id = $1 AND session_id = $2",
    [req.params.catId, req.params.sessionId]
  );
  if (!existing.length) return res.status(404).json({ error: "Not found" });
  const c = existing[0];
  const { rows } = await pool.query(
    "UPDATE categories SET name=$1, colour=$2, display_order=$3 WHERE id=$4 RETURNING *",
    [name ?? c.name, colour ?? c.colour, display_order ?? c.display_order, c.id]
  );
  res.json(rows[0]);
});

router.delete("/:catId", requireFacilitator, async (req, res) => {
  await pool.query(
    "DELETE FROM categories WHERE id = $1 AND session_id = $2",
    [req.params.catId, req.params.sessionId]
  );
  res.status(204).end();
});

export default router;
