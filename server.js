import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Users ────────────────────────────────────────────────────────

// Get user by username
app.get('/api/users/:username', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, display_name, created_at FROM users WHERE username = $1',
      [req.params.username]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create user
app.post('/api/users', async (req, res) => {
  try {
    const { username, display_name } = req.body;
    if (!username || !display_name) return res.status(400).json({ error: 'username and display_name required' });
    const result = await pool.query(
      'INSERT INTO users (username, display_name) VALUES ($1, $2) RETURNING id, username, display_name, created_at',
      [username.trim().toLowerCase(), display_name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already taken' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Teams ────────────────────────────────────────────────────────

// List all teams
app.get('/api/teams', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.name, t.description, t.created_at,
        COUNT(tm.id) FILTER (WHERE tm.status = 'approved') AS member_count
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id = t.id
      GROUP BY t.id ORDER BY t.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single team with members
app.get('/api/teams/:teamId', async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const [teamRes, membersRes] = await Promise.all([
      pool.query('SELECT id, name, description, created_at FROM teams WHERE id = $1', [teamId]),
      pool.query(`
        SELECT u.id, u.username, u.display_name, tm.role, tm.status, tm.joined_at
        FROM team_members tm JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = $1 ORDER BY tm.role, u.display_name
      `, [teamId]),
    ]);
    if (teamRes.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    res.json({ ...teamRes.rows[0], members: membersRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get teams for a user
app.get('/api/users/:userId/teams', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.name, t.description, tm.role, tm.status
      FROM team_members tm JOIN teams t ON t.id = tm.team_id
      WHERE tm.user_id = $1
      ORDER BY t.name
    `, [req.params.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create team (creator becomes owner)
app.post('/api/teams', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, creator_id } = req.body;
    if (!name || !creator_id) return res.status(400).json({ error: 'name and creator_id required' });
    await client.query('BEGIN');
    const teamRes = await client.query(
      'INSERT INTO teams (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at',
      [name.trim(), description?.trim() || null]
    );
    const team = teamRes.rows[0];
    await client.query(
      "INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'owner', 'approved')",
      [team.id, creator_id]
    );
    await client.query('COMMIT');
    res.status(201).json(team);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Team name already taken' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ─── Team Membership ──────────────────────────────────────────────

// Request to join a team
app.post('/api/teams/:teamId/join', async (req, res) => {
  try {
    const { user_id } = req.body;
    const teamId = parseInt(req.params.teamId);
    await pool.query(
      "INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'member', 'pending') ON CONFLICT (team_id, user_id) DO NOTHING",
      [teamId, user_id]
    );
    res.json({ success: true, message: 'Join request sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Directly add a member (owner/manager only) — immediately approved
app.post('/api/teams/:teamId/add', async (req, res) => {
  try {
    const { requester_id, username } = req.body;
    const teamId = parseInt(req.params.teamId);

    // Check requester is owner or manager
    const reqCheck = await pool.query(
      "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'approved'",
      [teamId, requester_id]
    );
    if (!reqCheck.rows.length || !['owner', 'manager'].includes(reqCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Find target user
    const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [username.trim().toLowerCase()]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });
    const targetId = userRes.rows[0].id;

    await pool.query(
      "INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'member', 'approved') ON CONFLICT (team_id, user_id) DO UPDATE SET status = 'approved'",
      [teamId, targetId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve a pending join request (owner/manager only)
app.post('/api/teams/:teamId/members/:userId/approve', async (req, res) => {
  try {
    const { requester_id } = req.body;
    const { teamId, userId } = req.params;

    const reqCheck = await pool.query(
      "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'approved'",
      [teamId, requester_id]
    );
    if (!reqCheck.rows.length || !['owner', 'manager'].includes(reqCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query(
      "UPDATE team_members SET status = 'approved' WHERE team_id = $1 AND user_id = $2",
      [teamId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change a member's role (owner only)
app.put('/api/teams/:teamId/members/:userId/role', async (req, res) => {
  try {
    const { requester_id, role } = req.body;
    const { teamId, userId } = req.params;

    if (!['manager', 'member'].includes(role)) return res.status(400).json({ error: 'Role must be manager or member' });

    const reqCheck = await pool.query(
      "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'approved'",
      [teamId, requester_id]
    );
    if (!reqCheck.rows.length || reqCheck.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can change roles' });
    }

    // Cannot change owner's own role
    if (String(userId) === String(requester_id)) return res.status(400).json({ error: 'Cannot change your own role' });

    await pool.query(
      'UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3',
      [role, teamId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove a member (owner/manager, or member leaving themselves)
app.delete('/api/teams/:teamId/members/:userId', async (req, res) => {
  try {
    const { requester_id } = req.body;
    const { teamId, userId } = req.params;

    const isSelf = String(requester_id) === String(userId);

    if (!isSelf) {
      const reqCheck = await pool.query(
        "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'approved'",
        [teamId, requester_id]
      );
      if (!reqCheck.rows.length || !['owner', 'manager'].includes(reqCheck.rows[0].role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      // Managers cannot remove other managers or owner
      const targetCheck = await pool.query(
        'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
        [teamId, userId]
      );
      if (targetCheck.rows.length && ['owner', 'manager'].includes(targetCheck.rows[0].role) && reqCheck.rows[0].role === 'manager') {
        return res.status(403).json({ error: 'Managers cannot remove owners or other managers' });
      }
    }

    await pool.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Mastered Cards ───────────────────────────────────────────────

app.get('/api/mastered/:kid', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT simplified, unit_number, mastered_at FROM mastered_cards WHERE kid = $1 ORDER BY mastered_at DESC',
      [req.params.kid]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch mastered cards' });
  }
});

app.post('/api/mastered', async (req, res) => {
  try {
    const { kid, simplified, unit_number } = req.body;
    if (!kid || !simplified) return res.status(400).json({ error: 'kid and simplified are required' });
    await pool.query(
      `INSERT INTO mastered_cards (kid, simplified, unit_number) VALUES ($1, $2, $3) ON CONFLICT (kid, simplified) DO NOTHING`,
      [kid, simplified, unit_number || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save mastered card' });
  }
});

app.delete('/api/mastered', async (req, res) => {
  try {
    const { kid, simplified } = req.body;
    if (!kid) return res.status(400).json({ error: 'kid is required' });
    if (simplified) {
      await pool.query('DELETE FROM mastered_cards WHERE kid = $1 AND simplified = $2', [kid, simplified]);
    } else {
      await pool.query('DELETE FROM mastered_cards WHERE kid = $1', [kid]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete mastered card' });
  }
});

// ─── Completed Lessons ────────────────────────────────────────────

app.get('/api/lessons/:kid', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT unit_number, unit_name, completed_at FROM completed_lessons WHERE kid = $1 ORDER BY completed_at DESC',
      [req.params.kid]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch completed lessons' });
  }
});

app.post('/api/lessons', async (req, res) => {
  try {
    const { kid, unit_number, unit_name } = req.body;
    if (!kid || !unit_number) return res.status(400).json({ error: 'kid and unit_number are required' });
    await pool.query(
      `INSERT INTO completed_lessons (kid, unit_number, unit_name) VALUES ($1, $2, $3)
       ON CONFLICT (kid, unit_number) DO UPDATE SET completed_at = NOW(), unit_name = $3`,
      [kid, unit_number, unit_name || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save completed lesson' });
  }
});

app.delete('/api/lessons', async (req, res) => {
  try {
    const { kid, unit_number } = req.body;
    if (!kid) return res.status(400).json({ error: 'kid is required' });
    if (unit_number) {
      await pool.query('DELETE FROM completed_lessons WHERE kid = $1 AND unit_number = $2', [kid, unit_number]);
    } else {
      await pool.query('DELETE FROM completed_lessons WHERE kid = $1', [kid]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete completed lesson' });
  }
});

// ─── Progress Summary ─────────────────────────────────────────────

app.get('/api/progress/:kid', async (req, res) => {
  try {
    const [mastered, lessons] = await Promise.all([
      pool.query('SELECT simplified, unit_number, mastered_at FROM mastered_cards WHERE kid = $1', [req.params.kid]),
      pool.query('SELECT unit_number, unit_name, completed_at FROM completed_lessons WHERE kid = $1', [req.params.kid]),
    ]);
    res.json({ masteredCards: mastered.rows, completedLessons: lessons.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

app.listen(PORT, () => console.log(`API server running on port ${PORT}`));
