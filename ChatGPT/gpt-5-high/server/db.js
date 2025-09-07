// db.js - SQLite database setup and helpers (no ORMs, plain SQL)
// Cleanly initializes schema and seeds an admin if not present.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data.sqlite3');
const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function init() {
  await run('PRAGMA foreign_keys = ON;');
  await run('PRAGMA journal_mode = WAL;');

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      location_found TEXT NOT NULL,
      date_found TEXT NOT NULL,
      photo_filename TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, claimed, archived
      reporter_name TEXT NOT NULL,
      reporter_email TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      claimant_name TEXT NOT NULL,
      claimant_email TEXT NOT NULL,
      student_id TEXT,
      message TEXT NOT NULL,
      proof_filename TEXT,
      status TEXT NOT NULL DEFAULT 'new', -- new, in_review, approved, rejected, resolved
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );
  `);

  // Seed default admin if missing
  const admin = await get(`SELECT * FROM users WHERE username = ?`, ['admin']);
  if (!admin) {
    const hash = await bcrypt.hash('ChangeMe123!', 10);
    await run(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`, [
      'admin', hash, 'admin'
    ]);
    console.log('Seeded default admin: username=admin, password=ChangeMe123!');
  }
}

module.exports = { db, run, get, all, init };
