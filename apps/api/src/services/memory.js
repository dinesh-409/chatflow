import sqlite3 from "sqlite3";
import { v4 as uuidv4 } from "uuid";

const db = new sqlite3.Database("./memory.db");

// Create table
db.run(`
  CREATE TABLE IF NOT EXISTS memory (
    id TEXT PRIMARY KEY,
    user TEXT,
    message TEXT,
    role TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export function saveMemory(user, message, role) {
    const id = uuidv4();

    db.run(
        "INSERT INTO memory (id, user, message, role) VALUES (?, ?, ?, ?)",
        [id, user, message, role]
    );
}

export function getMemory(user, callback) {
    db.all(
        "SELECT * FROM memory WHERE user = ? ORDER BY timestamp DESC LIMIT 20",
        [user],
        callback
    );
}