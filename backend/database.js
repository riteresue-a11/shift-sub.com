const { Pool } = require('pg');

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
  } catch (error) {
    console.error('❌ データベース初期化エラー:', error);
  } finally {
    client.release();
  }
}

module.exports = { pool, initializeDatabase };
