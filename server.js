import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve uploaded avatars statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl?.includes('supabase') ? { rejectUnauthorized: false } : false,
});

// ─── Multer setup ─────────────────────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads', 'avatars');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.params.username}_${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ─── Users ────────────────────────────────────────────────────────

app.get('/api/users/:username', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, display_name, avatar_url, created_at, (email IS NOT NULL) AS has_email FROM users WHERE username = $1',
      [req.params.username]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify email for an existing account (or set it if the account has none yet)
app.post('/api/users/verify', async (req, res) => {
  try {
    const { username, email } = req.body;
    if (!username || !email) return res.status(400).json({ error: 'username and email required' });
    const trimmedEmail = email.trim().toLowerCase();
    const result = await pool.query(
      'SELECT id, username, display_name, avatar_url, email FROM users WHERE username = $1',
      [username.trim().toLowerCase()]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    if (user.email === null) {
      // First time — associate this email with the account
      try {
        const updated = await pool.query(
          'UPDATE users SET email = $1 WHERE username = $2 RETURNING id, username, display_name, avatar_url, created_at',
          [trimmedEmail, username.trim().toLowerCase()]
        );
        return res.json(updated.rows[0]);
      } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
        throw err;
      }
    }
    if (user.email !== trimmedEmail) return res.status(401).json({ error: 'Email does not match' });
    const { email: _removed, ...safe } = user;
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users/sign-in-or-create', async (req, res) => {
  try {
    const { username, display_name, email } = req.body;
    if (!username || !display_name || !email) return res.status(400).json({ error: 'username, display_name, and email are required' });
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();
    const existing = await pool.query(
      'SELECT id, username, display_name, avatar_url, email, created_at FROM users WHERE username = $1',
      [trimmedUsername]
    );
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (user.email && user.email !== trimmedEmail) return res.status(401).json({ error: 'Email does not match' });
      if (!user.email) {
        const updated = await pool.query(
          'UPDATE users SET email = $1, display_name = COALESCE(display_name, $2) WHERE username = $3 RETURNING id, username, display_name, avatar_url, email, created_at',
          [trimmedEmail, display_name.trim(), trimmedUsername]
        );
        return res.json(updated.rows[0]);
      }
      return res.json(user);
    }
    const created = await pool.query(
      'INSERT INTO users (username, display_name, email) VALUES ($1, $2, $3) RETURNING id, username, display_name, avatar_url, email, created_at',
      [trimmedUsername, display_name.trim(), trimmedEmail]
    );
    res.status(201).json(created.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const detail = err.detail || '';
      const message = detail.includes('email') ? 'Email already in use' : 'Username already taken';
      return res.status(409).json({ error: message });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, display_name, email } = req.body;
    if (!username || !display_name || !email) return res.status(400).json({ error: 'username, display_name, and email are required' });
    const trimmedEmail = email.trim().toLowerCase();
    const result = await pool.query(
      'INSERT INTO users (username, display_name, email) VALUES ($1, $2, $3) RETURNING id, username, display_name, avatar_url, created_at',
      [username.trim().toLowerCase(), display_name.trim(), trimmedEmail]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const detail = err.detail || '';
      const message = detail.includes('email') ? 'Email already in use' : 'Username already taken';
      return res.status(409).json({ error: message });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update display name and/or avatar_url (for emoji avatars)
app.put('/api/users/:username', async (req, res) => {
  try {
    const { display_name, avatar_url } = req.body;
    if (!display_name || !display_name.trim()) return res.status(400).json({ error: 'display_name is required' });

    let result;
    if (avatar_url !== undefined) {
      result = await pool.query(
        'UPDATE users SET display_name = $1, avatar_url = $2 WHERE username = $3 RETURNING id, username, display_name, avatar_url, created_at',
        [display_name.trim(), avatar_url, req.params.username]
      );
    } else {
      result = await pool.query(
        'UPDATE users SET display_name = $1 WHERE username = $2 RETURNING id, username, display_name, avatar_url, created_at',
        [display_name.trim(), req.params.username]
      );
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload avatar
app.post('/api/users/:username/avatar', avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Delete old avatar file if it exists
    const old = await pool.query('SELECT avatar_url FROM users WHERE username = $1', [req.params.username]);
    if (old.rows.length && old.rows[0].avatar_url) {
      const oldPath = path.join(__dirname, old.rows[0].avatar_url);
      fs.unlink(oldPath, () => {});
    }

    const result = await pool.query(
      'UPDATE users SET avatar_url = $1 WHERE username = $2 RETURNING id, username, display_name, avatar_url',
      [avatarUrl, req.params.username]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Flashcards ───────────────────────────────────────────────────

app.get('/api/flashcards', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT simplified, traditional, pinyin, english, unit_number AS "unitNumber", unit_name AS "unitName" FROM flashcards ORDER BY unit_number::int, id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Teams ────────────────────────────────────────────────────────

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

app.get('/api/teams/:teamId', async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const [teamRes, membersRes] = await Promise.all([
      pool.query('SELECT id, name, description, created_at FROM teams WHERE id = $1', [teamId]),
      pool.query(`
        SELECT u.id, u.username, u.display_name, u.avatar_url, tm.role, tm.status, tm.joined_at
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

app.get('/api/users/:userId/teams', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.name, t.description, tm.role, tm.status
      FROM team_members tm JOIN teams t ON t.id = tm.team_id
      WHERE tm.user_id = $1 ORDER BY t.name
    `, [req.params.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

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

app.post('/api/teams/:teamId/add', async (req, res) => {
  try {
    const { requester_id, username } = req.body;
    const teamId = parseInt(req.params.teamId);
    const reqCheck = await pool.query(
      "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'approved'",
      [teamId, requester_id]
    );
    if (!reqCheck.rows.length || !['owner', 'manager'].includes(reqCheck.rows[0].role))
      return res.status(403).json({ error: 'Not authorized' });
    const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [username.trim().toLowerCase()]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });
    await pool.query(
      "INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'member', 'approved') ON CONFLICT (team_id, user_id) DO UPDATE SET status = 'approved'",
      [teamId, userRes.rows[0].id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/teams/:teamId/members/:userId/approve', async (req, res) => {
  try {
    const { requester_id } = req.body;
    const { teamId, userId } = req.params;
    const reqCheck = await pool.query(
      "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'approved'",
      [teamId, requester_id]
    );
    if (!reqCheck.rows.length || !['owner', 'manager'].includes(reqCheck.rows[0].role))
      return res.status(403).json({ error: 'Not authorized' });
    await pool.query("UPDATE team_members SET status = 'approved' WHERE team_id = $1 AND user_id = $2", [teamId, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/teams/:teamId/members/:userId/role', async (req, res) => {
  try {
    const { requester_id, role } = req.body;
    const { teamId, userId } = req.params;
    if (!['manager', 'member'].includes(role)) return res.status(400).json({ error: 'Role must be manager or member' });
    const reqCheck = await pool.query(
      "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'approved'",
      [teamId, requester_id]
    );
    if (!reqCheck.rows.length || reqCheck.rows[0].role !== 'owner')
      return res.status(403).json({ error: 'Only the owner can change roles' });
    if (String(userId) === String(requester_id)) return res.status(400).json({ error: 'Cannot change your own role' });
    await pool.query('UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3', [role, teamId, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

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
      if (!reqCheck.rows.length || !['owner', 'manager'].includes(reqCheck.rows[0].role))
        return res.status(403).json({ error: 'Not authorized' });
      const targetCheck = await pool.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
      if (targetCheck.rows.length && ['owner', 'manager'].includes(targetCheck.rows[0].role) && reqCheck.rows[0].role === 'manager')
        return res.status(403).json({ error: 'Managers cannot remove owners or other managers' });
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
    res.status(500).json({ error: 'Failed to save mastered card' });
  }
});

app.delete('/api/mastered', async (req, res) => {
  try {
    const { kid, simplified, unit_number } = req.body;
    if (!kid) return res.status(400).json({ error: 'kid is required' });
    if (simplified) {
      await pool.query('DELETE FROM mastered_cards WHERE kid = $1 AND simplified = $2', [kid, simplified]);
    } else if (unit_number) {
      await pool.query('DELETE FROM mastered_cards WHERE kid = $1 AND unit_number = $2', [kid, unit_number]);
    } else {
      await pool.query('DELETE FROM mastered_cards WHERE kid = $1', [kid]);
    }
    res.json({ success: true });
  } catch (err) {
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
    res.status(500).json({ error: 'Failed to fetch completed lessons' });
  }
});

app.post('/api/lessons', async (req, res) => {
  try {
    const { kid, unit_number, unit_name, time_ms } = req.body;
    if (!kid || !unit_number) return res.status(400).json({ error: 'kid and unit_number are required' });
    await pool.query(
      `INSERT INTO completed_lessons (kid, unit_number, unit_name, time_ms) VALUES ($1, $2, $3, $4)
       ON CONFLICT (kid, unit_number) DO UPDATE SET
         completed_at = NOW(),
         unit_name = $3,
         time_ms = CASE
           WHEN EXCLUDED.time_ms IS NULL THEN completed_lessons.time_ms
           WHEN completed_lessons.time_ms IS NULL THEN EXCLUDED.time_ms
           ELSE LEAST(EXCLUDED.time_ms, completed_lessons.time_ms)
         END`,
      [kid, unit_number, unit_name || null, time_ms ?? null]
    );
    res.json({ success: true });
  } catch (err) {
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
    res.status(500).json({ error: 'Failed to delete completed lesson' });
  }
});

// ─── Progress Summary ─────────────────────────────────────────────

app.get('/api/progress/:kid', async (req, res) => {
  try {
    const [mastered, lessons] = await Promise.all([
      pool.query('SELECT simplified, unit_number, mastered_at FROM mastered_cards WHERE kid = $1', [req.params.kid]),
      pool.query('SELECT unit_number, unit_name, completed_at, time_ms FROM completed_lessons WHERE kid = $1', [req.params.kid]),
    ]);
    res.json({ masteredCards: mastered.rows, completedLessons: lessons.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// ─── Team Lesson Records (top 2 per lesson) ───────────────────────
app.get('/api/teams/:teamId/lesson-records', async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const result = await pool.query(`
      WITH ranked AS (
        SELECT
          cl.unit_number, cl.unit_name, cl.time_ms,
          u.display_name, u.avatar_url, u.username,
          ROW_NUMBER() OVER (PARTITION BY cl.unit_number ORDER BY cl.time_ms ASC NULLS LAST) AS rn
        FROM completed_lessons cl
        JOIN users u ON u.username = cl.kid
        JOIN team_members tm ON tm.user_id = u.id
        WHERE tm.team_id = $1 AND tm.status = 'approved'
      )
      SELECT * FROM ranked WHERE rn <= 2
      ORDER BY unit_number, rn
    `, [teamId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve React build in production
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => console.log(`API server running on port ${PORT}`));
