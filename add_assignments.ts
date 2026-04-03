import Database from 'better-sqlite3';

const db = new Database('rickshaw_manager.db');

const insertAssignment = db.prepare('INSERT INTO rickshaw_assignments (rickshaw_id, driver_id, start_date) VALUES (?, ?, ?)');

// Assign BAB 2023 to Gujjar
insertAssignment.run(1, 1, '2025-10-01');

console.log('Assignments added.');
