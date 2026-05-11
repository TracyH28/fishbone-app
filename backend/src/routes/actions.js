import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireFacilitator } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

router.post("/", requireFacilitator, async (req, res) => {
  const { cause_id, description, owner } = req.body;
  if (!cause_id || !description || !owner)
    return res.status(400).json({ error: "cause_id, description, owner required" });
  if (!["siemens", "csl"].includes(owner))
    return res.status(400).json({ error: "owner must be siemens or csl" });

  const { rows } = await pool.query(
    "INSERT INTO actions (cause_id, description, owner) VALUES ($1,$2,$3) RETURNING *",
    [cause_id, description.trim(), owner]
  );
  req.app.get("io").to(`session:${req.params.sessionId}`).emit("action:added", rows[0]);
  res.status(201).json(rows[0]);
});

router.patch("/:actionId", requireFacilitator, async (req, res) => {
  const { description, owner } = req.body;
  const { rows: existing } = await pool.query("SELECT * FROM actions WHERE id = $1", [req.params.actionId]);
  if (!existing.length) return res.status(404).json({ error: "Not found" });
  const a = existing[0];
  const { rows } = await pool.query(
    "UPDATE actions SET description=$1, owner=$2 WHERE id=$3 RETURNING *",
    [description ?? a.description, owner ?? a.owner, a.id]
  );
  req.app.get("io").to(`session:${req.params.sessionId}`).emit("action:updated", rows[0]);
  res.json(rows[0]);
});

router.delete("/:actionId", requireFacilitator, async (req, res) => {
  const { rows } = await pool.query(
    "DELETE FROM actions WHERE id=$1 RETURNING id", [req.params.actionId]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  req.app.get("io").to(`session:${req.params.sessionId}`).emit("action:deleted", { id: rows[0].id });
  res.status(204).end();
});

export default router;
