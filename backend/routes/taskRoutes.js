import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken } from '../auth.js';

const router = Router();
router.use(authenticateToken); // All task routes require auth

// GET /api/tasks — fetch all tasks
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, u.name AS creator_name
       FROM tasks t
       LEFT JOIN users u ON t.created_by = u.id
       ORDER BY t.status, t.position ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// POST /api/tasks — create task
router.post('/', async (req, res) => {
  const { title, description, status = 'todo' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  try {
    // Position = max position in that column + 1
    const posResult = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE status=$1', [status]
    );
    const position = posResult.rows[0].next_pos;

    const result = await pool.query(
      `INSERT INTO tasks (title, description, status, created_by, position)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, description || null, status, req.user.id, position]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/tasks/:id — update task (title, description, status, position)
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, status, position } = req.body;

  try {
    const result = await pool.query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3, status),
         position = COALESCE($4, position)
       WHERE id=$5 RETURNING *`,
      [title, description, status, position, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json({ deleted: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;