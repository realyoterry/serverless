import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const dbDir = '/tmp'; // Works on Vercel
const dbPath = join(dbDir, 'ships.db');

if (!existsSync(dbDir)) mkdirSync(dbDir);

const db = new Database(dbPath);

// Create the table
db.prepare(`
	CREATE TABLE IF NOT EXISTS ships (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user1 TEXT,
		user2 TEXT,
		name TEXT UNIQUE,
		supportCount INTEGER DEFAULT 0
	)
`).run();

export default db;
