const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const { pool, initializeDatabase } = require('./database');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors({
  origin: ['https://shift-sub-com.onrender.com', 'https://shift-sub.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({ message: 'レストランシフト管理システム API' });
});

// ========== 認証 ==========
// ログイン
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query(
      'SELECT * FROM accounts WHERE username = $1 AND password = $2 AND status = $3',
      [username, password, 'approved']
    );
    
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.status(401).json({ success: false, message: 'ログイン失敗' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== アカウント管理 ==========
// 全アカウント取得
app.get('/api/accounts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM accounts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// アカウント作成（新規登録）
app.post('/api/accounts', async (req, res) => {
  try {
    const { username, password, account_type } = req.body;
    const id = uuidv4();
    const status = account_type === 'manager' ? 'approved' : 'pending';
    
    await pool.query(
      'INSERT INTO accounts (id, username, password, account_type, status) VALUES ($1, $2, $3, $4, $5)',
      [id, username, password, account_type, status]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// アカウント更新
app.put('/api/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, status, approved_at } = req.body;
    
    let query = 'UPDATE accounts SET ';
    const values = [];
    let paramCount = 1;
    
    if (password !== undefined) {
      query += `password = $${paramCount}, `;
      values.push(password);
      paramCount++;
    }
    
    if (status !== undefined) {
      query += `status = $${paramCount}, `;
      values.push(status);
      paramCount++;
    }
    
    if (approved_at !== undefined) {
      query += `approved_at = $${paramCount}, `;
      values.push(approved_at);
      paramCount++;
    }
    
    query = query.slice(0, -2); // 最後のカンマを削除
    query += ` WHERE id = $${paramCount}`;
    values.push(id);
    
    await pool.query(query, values);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// アカウント削除
app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM accounts WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== シフト期間管理 ==========
// 全期間取得
app.get('/api/shift_periods', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shift_periods ORDER BY start_date DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 期間作成
app.post('/api/shift_periods', async (req, res) => {
  try {
    const { id, start_date, end_date, status, display_name } = req.body;
    await pool.query(
      'INSERT INTO shift_periods (id, start_date, end_date, status, display_name) VALUES ($1, $2, $3, $4, $5)',
      [id, start_date, end_date, status, display_name]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 期間更新
app.put('/api/shift_periods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await pool.query('UPDATE shift_periods SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 期間削除
app.delete('/api/shift_periods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM shift_periods WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== シフト管理 ==========
// 全シフト取得
app.get('/api/shifts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shifts ORDER BY date ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// シフト作成
app.post('/api/shifts', async (req, res) => {
  try {
    const { id, period_id, staff_name, date, shift_type } = req.body;
    await pool.query(
      'INSERT INTO shifts (id, period_id, staff_name, date, shift_type) VALUES ($1, $2, $3, $4, $5)',
      [id, period_id, staff_name, date, shift_type]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// シフト削除
app.delete('/api/shifts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM shifts WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 初期データ挿入
async function insertInitialData() {
  try {
    // kokianアカウントが存在するか確認
    const result = await pool.query('SELECT * FROM accounts WHERE username = $1', ['kokian']);
    
    if (result.rows.length === 0) {
      // kokianアカウントを挿入
      const { v4: uuidv4 } = require('uuid');
      await pool.query(
        'INSERT INTO accounts (id, username, password, account_type, status, approved_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), 'kokian', '1111', 'manager', 'approved', new Date().toISOString()]
      );
      console.log('✅ 初期アカウント(kokian)を作成しました');
      
      // 初期シフト期間を挿入
      const confirmedId = uuidv4();
      const collectingId = uuidv4();
      
      await pool.query(
        'INSERT INTO shift_periods (id, start_date, end_date, status, display_name) VALUES ($1, $2, $3, $4, $5)',
        [confirmedId, '2025-12-16', '2026-01-15', 'confirmed', '2025年12月16日〜2026年1月15日']
      );
      
      await pool.query(
        'INSERT INTO shift_periods (id, start_date, end_date, status, display_name) VALUES ($1, $2, $3, $4, $5)',
        [collectingId, '2026-01-16', '2026-02-15', 'collecting', '2026年1月16日〜2026年2月15日']
      );
      
      console.log('✅ 初期シフト期間を作成しました');
    } else {
      console.log('ℹ️ 初期データは既に存在します');
    }
  } catch (error) {
    console.error('❌ 初期データ挿入エラー:', error);
  }
}

// サーバー起動
app.listen(PORT, async () => {
  console.log(`🚀 サーバー起動: http://localhost:${PORT}`);
  await initializeDatabase();
  await insertInitialData();
});
