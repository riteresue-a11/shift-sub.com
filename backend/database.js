const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// データベース接続プール
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// データベーステーブル初期化
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // accountsテーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        account_type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP
      )
    `);

    // shift_periodsテーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS shift_periods (
        id TEXT PRIMARY KEY,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL,
        display_name TEXT
      )
    `);

    // shiftsテーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        period_id TEXT NOT NULL,
        staff_name TEXT NOT NULL,
        date TEXT NOT NULL,
        shift_type TEXT NOT NULL
      )
    `);

    console.log('✅ データベーステーブル初期化完了');

    // 初期管理者アカウント作成(アカウントが0件の場合のみ)
    const accountCheck = await client.query('SELECT COUNT(*) FROM accounts');
    if (accountCheck.rows[0].count === '0') {
      const defaultUserId = uuidv4();
      await client.query(
        `INSERT INTO accounts (id, username, password, account_type, status, created_at, approved_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [defaultUserId, 'kokian', '1111', 'manager', 'approved']
      );
      console.log('✅ 初期管理者アカウント作成完了 (username: kokian)');

      // 初期シフト期間を作成
      const confirmedId = uuidv4();
      const collectingId = uuidv4();
      
      await client.query(
        'INSERT INTO shift_periods (id, start_date, end_date, status, display_name) VALUES ($1, $2, $3, $4, $5)',
        [confirmedId, '2025-12-16', '2026-01-15', 'confirmed', '2025年12月16日〜2026年1月15日']
      );
      
      await client.query(
        'INSERT INTO shift_periods (id, start_date, end_date, status, display_name) VALUES ($1, $2, $3, $4, $5)',
        [collectingId, '2026-01-16', '2026-02-15', 'collecting', '2026年1月16日〜2026年2月15日']
      );
      
      console.log('✅ 初期シフト期間作成完了');
    }

  } catch (error) {
    console.error('❌ データベース初期化エラー:', error);
  } finally {
    client.release();
  }
}

module.exports = { pool, initializeDatabase };