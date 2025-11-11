const { pool } = require('../Config/db')
//const bcrypt = require('bcrypt')

async function initInventoryStatusLogTable() {
  await pool.query(`
  CREATE TABLE IF NOT EXISTS status_log (
    log_id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    additional_notes TEXT,
    updated_by INT REFERENCES users(id) ON DELETE SET NULL,
    display BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
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
    SELECT s.*,
           COALESCE(NULLIF(TRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username) AS updated_by_name,
           u.username AS updated_by_username
    FROM status_log s
    LEFT JOIN users u ON u.id = s.updated_by
    WHERE s.entity_type = $1 AND s.entity_id = $2 AND s.display = TRUE
    ORDER BY s.updated_at DESC, s.log_id DESC
  `,
    [entity_type, entity_id]
  )
  return result.rows
}
//get all logs
async function getAllLogs() {
  const result = await pool.query(
    `
    SELECT s.*,
           COALESCE(NULLIF(TRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username) AS updated_by_name,
           u.username AS updated_by_username
    FROM status_log s
    LEFT JOIN users u ON u.id = s.updated_by
    WHERE s.display = TRUE
    ORDER BY s.updated_at DESC, s.log_id DESC
    `
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
  additional_notes,
  updated_by
) {
  await pool.query(
    `
    UPDATE status_log
    SET entity_type = $1,
        entity_id = $2,
        status = $3,
        notes = $4,
        additional_notes = $5,
        updated_by = $6,
        updated_at = NOW()
    WHERE log_id = $7
  `,
    [
      entity_type,
      entity_id,
      status,
      notes,
      additional_notes,
      updated_by,
      log_id,
    ]
  )
}

// NEW: soft delete a log
async function softDeleteLog(log_id) {
  await pool.query(
    `
      UPDATE status_log
      SET display = FALSE, updated_at = NOW()
      WHERE log_id = $1
    `,
    [log_id]
  )
}

module.exports = {
  initInventoryStatusLogTable,
  createStatusLog,
  findLogsByEntity,
  getAllLogs,
  updateLog,
  softDeleteLog,
}
