import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Create the .data folder if it doesn't exist
const dataDir = join(process.cwd(), '.data');
if (!existsSync(dataDir)) {
	mkdirSync(dataDir);
}

const dbPath = join(dataDir, 'ships.db');
const db = new Database(dbPath);

// Create the table if it doesn't exist
db.prepare(`
	CREATE TABLE IF NOT EXISTS ships (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user1_id TEXT NOT NULL,
		user2_id TEXT NOT NULL,
		ship_name TEXT NOT NULL,
		support_count INTEGER NOT NULL DEFAULT 0,
		UNIQUE(user1_id, user2_id)
	)
`).run();

export default db;
