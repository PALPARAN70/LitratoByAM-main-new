const { pool } = require('../Config/db')
//const bcrypt = require('bcrypt')

async function initInventoryStatusLogTable() {
  await pool.query(`
    CREATE TABLE status_log (
    log_id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- "Inventory" or "Package"
    entity_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    updated_by INT NOT NULL, -- FK to staff/admin later
    updated_at TIMESTAMP DEFAULT NOW(),
    display BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
}
//create status log
async function createStatusLog(
  entity_type,
  entity_id,
  status,
  notes,
  updated_by
) {
  await pool.query(
    `
    INSERT INTO status_log (entity_type, entity_id, status, notes, updated_by)
    VALUES ($1, $2, $3, $4, $5)
  `,
    [entity_type, entity_id, status, notes, updated_by]
  )
}
//find logs by entity
async function findLogsByEntity(entity_type, entity_id) {
  const result = await pool.query(
    `
    SELECT * FROM status_log
    WHERE entity_type = $1 AND entity_id = $2
  `,
    [entity_type, entity_id]
  )
  return result.rows
}
//get all logs
async function getAllLogs() {
  const result = await pool.query(
    'SELECT * FROM status_log WHERE display = TRUE'
  )
  return result.rows
}

//update log
async function updateLog(
  log_id,
  entity_type,
  entity_id,
  status,
  notes,
  updated_by
) {
  await pool.query(
    `
    UPDATE status_log
    SET entity_type = $1, entity_id = $2, status = $3, notes = $4, updated_by = $5, updated_at = NOW()
    WHERE log_id = $6
  `,
    [entity_type, entity_id, status, notes, updated_by, log_id]
  )
}

module.exports = {
  initInventoryStatusLogTable,
  createStatusLog,
  findLogsByEntity,
  getAllLogs,
  updateLog,
}
