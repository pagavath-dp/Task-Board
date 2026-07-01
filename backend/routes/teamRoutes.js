import { Router } from 'express';
import crypto from 'crypto';
import pool from '../db.js';
import { authenticateToken } from '../auth.js';

const router = Router();
router.use(authenticateToken);

function generateJoinCode() {
  // 8 uppercase alphanumeric chars, unambiguous charset (no 0/O/1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[crypto.randomInt(chars.length)]).join('');
}

// GET /api/teams — list teams the user belongs to
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.name, t.join_code, t.created_by,
              COUNT(tm2.user_id) AS member_count
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1
       JOIN team_members tm2 ON tm2.team_id = t.id
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/teams — create a team, auto-join creator
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Team name required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let joinCode, exists = true;
    while (exists) {
      joinCode = generateJoinCode();
      const check = await client.query('SELECT 1 FROM teams WHERE join_code=$1', [joinCode]);
      exists = check.rows.length > 0;
    }

    const teamResult = await client.query(
      'INSERT INTO teams (name, join_code, created_by) VALUES ($1,$2,$3) RETURNING *',
      [name.trim(), joinCode, req.user.id]
    );
    const team = teamResult.rows[0];

    await client.query(
      'INSERT INTO team_members (team_id, user_id) VALUES ($1,$2)',
      [team.id, req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...team, member_count: 1 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/teams/join — join via code
router.post('/join', async (req, res) => {
  const { join_code } = req.body;
  if (!join_code?.trim()) return res.status(400).json({ error: 'Join code required' });

  try {
    const teamResult = await pool.query(
      'SELECT * FROM teams WHERE join_code=$1', [join_code.trim().toUpperCase()]
    );
    if (!teamResult.rows.length) return res.status(404).json({ error: 'Invalid join code' });
    const team = teamResult.rows[0];

    const already = await pool.query(
      'SELECT 1 FROM team_members WHERE team_id=$1 AND user_id=$2', [team.id, req.user.id]
    );
    if (already.rows.length) return res.status(409).json({ error: 'Already a member of this team' });

    await pool.query(
      'INSERT INTO team_members (team_id, user_id) VALUES ($1,$2)', [team.id, req.user.id]
    );

    res.status(201).json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/teams/:id/leave
router.delete('/:id/leave', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM team_members WHERE team_id=$1 AND user_id=$2 RETURNING *',
      [id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not a member of this team' });
    res.json({ left: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;