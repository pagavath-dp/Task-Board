import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken } from '../auth.js';

const router = Router();
router.use(authenticateToken);

// Helper: verify the user can access this board (personal or team they're in)
async function canAccessBoard(userId, teamId) {
  if (!teamId) return true; // personal board, always accessible to self
  const result = await pool.query(
    'SELECT 1 FROM team_members WHERE team_id=$1 AND user_id=$2', [teamId, userId]
  );
  return result.rows.length > 0;
}

// GET /api/tasks?team_id=5  OR  /api/tasks  (personal)
router.get('/', async (req, res) => {
  const teamId = req.query.team_id ? parseInt(req.query.team_id) : null;

  const allowed = await canAccessBoard(req.user.id, teamId);
  if (!allowed) return res.status(403).json({ error: 'Not a member of this team' });

  try {
    const result = await pool.query(
      teamId
        ? `SELECT t.*, u.name AS creator_name
           FROM tasks t LEFT JOIN users u ON t.created_by = u.id
           WHERE t.team_id = $1
           ORDER BY t.status, t.position ASC`
        : `SELECT t.*, u.name AS creator_name
           FROM tasks t LEFT JOIN users u ON t.created_by = u.id
           WHERE t.team_id IS NULL AND t.created_by = $1
           ORDER BY t.status, t.position ASC`,
      teamId ? [teamId] : [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  const { title, description, status = 'todo', team_id = null } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const allowed = await canAccessBoard(req.user.id, team_id);
  if (!allowed) return res.status(403).json({ error: 'Not a member of this team' });

  try {
    const posResult = await pool.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks
       WHERE status=$1 AND ${team_id ? 'team_id=$2' : 'team_id IS NULL AND created_by=$2'}`,
      [status, team_id || req.user.id]
    );
    const position = posResult.rows[0].next_pos;

    const result = await pool.query(
      `INSERT INTO tasks (title, description, status, created_by, position, team_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [title, description || null, status, req.user.id, position, team_id]
    );

    const fullTask = await pool.query(
      `SELECT t.*, u.name AS creator_name
       FROM tasks t LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(fullTask.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, status, position } = req.body;

  try {
    // Verify ownership/access before allowing the update
    const existing = await pool.query('SELECT team_id, created_by FROM tasks WHERE id=$1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Task not found' });
    const { team_id, created_by } = existing.rows[0];

    const allowed = team_id
      ? await canAccessBoard(req.user.id, team_id)
      : created_by === req.user.id;
    if (!allowed) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3, status),
         position = COALESCE($4, position)
       WHERE id=$5 RETURNING id`,
      [title, description, status, position, id]
    );

    const fullTask = await pool.query(
      `SELECT t.*, u.name AS creator_name
       FROM tasks t LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = $1`,
      [result.rows[0].id]
    );

    res.json(fullTask.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query('SELECT team_id, created_by FROM tasks WHERE id=$1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Task not found' });
    const { team_id, created_by } = existing.rows[0];

    const allowed = team_id
      ? await canAccessBoard(req.user.id, team_id)
      : created_by === req.user.id;
    if (!allowed) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING id', [id]);
    res.json({ deleted: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;