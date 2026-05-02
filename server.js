import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ─── Mastered Cards ───────────────────────────────────────────────

// Get all mastered cards for a kid
app.get('/api/mastered/:kid', async (req, res) => {
  try {
    const { kid } = req.params;
    const result = await pool.query(
      'SELECT simplified, unit_number, mastered_at FROM mastered_cards WHERE kid = $1 ORDER BY mastered_at DESC',
      [kid]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch mastered cards' });
  }
});

// Mark a card as mastered
app.post('/api/mastered', async (req, res) => {
  try {
    const { kid, simplified, unit_number } = req.body;
    if (!kid || !simplified) {
      return res.status(400).json({ error: 'kid and simplified are required' });
    }
    await pool.query(
      `INSERT INTO mastered_cards (kid, simplified, unit_number)
       VALUES ($1, $2, $3)
       ON CONFLICT (kid, simplified) DO NOTHING`,
      [kid, simplified, unit_number || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save mastered card' });
  }
});

// Unmark a card as mastered (e.g., on reset)
app.delete('/api/mastered', async (req, res) => {
  try {
    const { kid, simplified } = req.body;
    if (!kid) {
      return res.status(400).json({ error: 'kid is required' });
    }
    if (simplified) {
      await pool.query(
        'DELETE FROM mastered_cards WHERE kid = $1 AND simplified = $2',
        [kid, simplified]
      );
    } else {
      // Clear all mastered cards for kid (used on full reset)
      await pool.query('DELETE FROM mastered_cards WHERE kid = $1', [kid]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete mastered card' });
  }
});

// ─── Completed Lessons ────────────────────────────────────────────

// Get all completed lessons for a kid
app.get('/api/lessons/:kid', async (req, res) => {
  try {
    const { kid } = req.params;
    const result = await pool.query(
      'SELECT unit_number, unit_name, completed_at FROM completed_lessons WHERE kid = $1 ORDER BY completed_at DESC',
      [kid]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch completed lessons' });
  }
});

// Mark a lesson as completed
app.post('/api/lessons', async (req, res) => {
  try {
    const { kid, unit_number, unit_name } = req.body;
    if (!kid || !unit_number) {
      return res.status(400).json({ error: 'kid and unit_number are required' });
    }
    await pool.query(
      `INSERT INTO completed_lessons (kid, unit_number, unit_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (kid, unit_number) DO UPDATE SET completed_at = NOW(), unit_name = $3`,
      [kid, unit_number, unit_name || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save completed lesson' });
  }
});

// Uncomplete a lesson
app.delete('/api/lessons', async (req, res) => {
  try {
    const { kid, unit_number } = req.body;
    if (!kid) {
      return res.status(400).json({ error: 'kid is required' });
    }
    if (unit_number) {
      await pool.query(
        'DELETE FROM completed_lessons WHERE kid = $1 AND unit_number = $2',
        [kid, unit_number]
      );
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

// Get full progress summary for a kid
app.get('/api/progress/:kid', async (req, res) => {
  try {
    const { kid } = req.params;
    const [mastered, lessons] = await Promise.all([
      pool.query(
        'SELECT simplified, unit_number, mastered_at FROM mastered_cards WHERE kid = $1',
        [kid]
      ),
      pool.query(
        'SELECT unit_number, unit_name, completed_at FROM completed_lessons WHERE kid = $1',
        [kid]
      ),
    ]);
    res.json({
      masteredCards: mastered.rows,
      completedLessons: lessons.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
