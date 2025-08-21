const express = require('express');
const cors = require('cors');
const { connect } = require('@tidbcloud/serverless');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// TiDB connection via environment variables
const requiredEnv = ['TIDB_HOST', 'TIDB_USERNAME', 'TIDB_PASSWORD', 'TIDB_DATABASE'];
const missing = requiredEnv.filter((k) => !process.env[k] || process.env[k].trim() === '');
if (missing.length) {
  console.warn(`⚠️ Missing required environment variables: ${missing.join(', ')}`);
  console.warn('Create backend/.env based on backend/.env.example');
}

const conn = connect({
  host: process.env.TIDB_HOST,
  username: process.env.TIDB_USERNAME,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE
});

// Initialize database table
async function initializeDatabase() {
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS mood_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mood VARCHAR(50) NOT NULL,
        confidence DECIMAL(5,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database table initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TiDB Backend API is running' });
});

app.post('/api/moods', async (req, res) => {
  try {
    const { mood, confidence } = req.body;
    
    if (!mood || confidence === undefined) {
      return res.status(400).json({ error: 'Missing mood or confidence' });
    }

    const result = await conn.execute(
      'INSERT INTO mood_entries (mood, confidence) VALUES (?, ?)',
      [mood, confidence]
    );

    console.log('✅ Mood saved:', { mood, confidence });
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('❌ Error saving mood:', error);
    res.status(500).json({ error: 'Failed to save mood' });
  }
});

app.get('/api/moods/count', async (req, res) => {
  try {
    const result = await conn.execute('SELECT COUNT(*) as count FROM mood_entries');
    const count = result[0]?.count || 0;
    res.json({ count: parseInt(count) });
  } catch (error) {
    console.error('❌ Error getting mood count:', error);
    res.status(500).json({ error: 'Failed to get mood count' });
  }
});

app.get('/api/moods', async (req, res) => {
  try {
    const result = await conn.execute(
      'SELECT * FROM mood_entries ORDER BY created_at DESC LIMIT 10'
    );
    res.json({ moods: result || [] });
  } catch (error) {
    console.error('❌ Error getting moods:', error);
    res.status(500).json({ error: 'Failed to get moods' });
  }
});

// Start server
app.listen(port, async () => {
  console.log(`🚀 TiDB Backend API server running at http://localhost:${port}`);
  await initializeDatabase();
});
