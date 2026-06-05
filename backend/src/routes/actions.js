import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireFacilitator } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

router.post("/", requireFacilitator, async (req, res) => {
  const { cause_id, description, owner, owner_tags } = req.body;
  // owner_tags is provided for vision_setting sessions (multi-select); owner is required for lessons_learned
  const hasOwnerTags = Array.isArray(owner_tags) && owner_tags.length > 0;
  const resolvedOwner = hasOwnerTags ? 'vision_setting' : owner;
  if (!cause_id || !description || !resolvedOwner)
    return res.status(400).json({ error: "cause_id, description, and owner (or owner_tags) required" });
  if (!["siemens", "csl", "vision_setting"].includes(resolvedOwner))
    return res.status(400).json({ error: "owner must be siemens, csl, or vision_setting" });

  const { rows } = await pool.query(
    "INSERT INTO actions (cause_id, description, owner, owner_tags) VALUES ($1,$2,$3,$4) RETURNING *",
    [cause_id, description.trim(), resolvedOwner, hasOwnerTags ? owner_tags : null]
  );
  req.app.get("io").to(`session:${req.params.sessionId}`).emit("action:added", rows[0]);
  res.status(201).json(rows[0]);
});

router.patch("/:actionId", requireFacilitator, async (req, res) => {
  const { description, owner, owner_tags } = req.body;
  const { rows: existing } = await pool.query("SELECT * FROM actions WHERE id = $1", [req.params.actionId]);
  if (!existing.length) return res.status(404).json({ error: "Not found" });
  const a = existing[0];
  const hasOwnerTags = Array.isArray(owner_tags) && owner_tags.length > 0;
  const resolvedOwner = hasOwnerTags ? 'vision_setting' : (owner ?? a.owner);
  const { rows } = await pool.query(
    "UPDATE actions SET description=$1, owner=$2, owner_tags=$3 WHERE id=$4 RETURNING *",
    [description ?? a.description, resolvedOwner, hasOwnerTags ? owner_tags : (owner_tags === null ? null : a.owner_tags), a.id]
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
