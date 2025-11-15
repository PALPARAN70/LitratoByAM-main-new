const { pool } = require('../Config/db')
//const bcrypt = require('bcrypt')

async function initInventoryStatusLogTable() {
  // Legacy migration: rename old table if present
  await pool.query(`
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'status_log'
    )
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_log'
    ) THEN
      EXECUTE 'ALTER TABLE status_log RENAME TO inventory_log';
    END IF;
  END
  $$;
  `)

  await pool.query(`
  CREATE TABLE IF NOT EXISTS inventory_log (
    inventory_log_id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    additional_notes TEXT,
    updated_by INT REFERENCES users(id) ON DELETE SET NULL,
    display BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
  `)

  // Post-creation migrations (only run when table exists)
  await pool.query(`
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_log'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_log' AND column_name = 'log_id'
      ) THEN
        EXECUTE 'ALTER TABLE inventory_log RENAME COLUMN log_id TO inventory_log_id';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_log' AND column_name = 'last_updated'
      ) THEN
        EXECUTE 'ALTER TABLE inventory_log ADD COLUMN last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
        EXECUTE 'UPDATE inventory_log SET last_updated = CURRENT_TIMESTAMP WHERE last_updated IS NULL';
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_log' AND column_name = 'updated_at'
      ) THEN
        EXECUTE 'ALTER TABLE inventory_log DROP COLUMN updated_at';
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_log' AND column_name = 'last_updated'
      ) THEN
        EXECUTE 'ALTER TABLE inventory_log ALTER COLUMN last_updated SET DEFAULT CURRENT_TIMESTAMP';
      END IF;
    END IF;
  END
  $$;
  `)
}
//create status log
async function createStatusLog(
  entity_type,
  entity_id,
  status,
  notes,
  additional_notes,
  updated_by
) {
  await pool.query(
    `
    INSERT INTO inventory_log (entity_type, entity_id, status, notes, additional_notes, updated_by)
    VALUES ($1, $2, $3, $4, $5, $6)
  `,
    [entity_type, entity_id, status, notes, additional_notes, updated_by]
  )
}
//find logs by entity
async function findLogsByEntity(entity_type, entity_id) {
  const result = await pool.query(
    `
    SELECT s.*,
           COALESCE(NULLIF(TRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username) AS updated_by_name,
           u.username AS updated_by_username
    FROM inventory_log s
    LEFT JOIN users u ON u.id = s.updated_by
    WHERE s.entity_type = $1 AND s.entity_id = $2 AND s.display = TRUE
    ORDER BY s.last_updated DESC, s.inventory_log_id DESC
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
    FROM inventory_log s
    LEFT JOIN users u ON u.id = s.updated_by
    WHERE s.display = TRUE
    ORDER BY s.last_updated DESC, s.inventory_log_id DESC
    `
  )
  return result.rows
}

//update log
async function updateLog(
  inventory_log_id,
  entity_type,
  entity_id,
  status,
  notes,
  additional_notes,
  updated_by
) {
  await pool.query(
    `
    UPDATE inventory_log
    SET entity_type = $1,
        entity_id = $2,
        status = $3,
        notes = $4,
        additional_notes = $5,
        updated_by = $6,
        last_updated = NOW()
    WHERE inventory_log_id = $7
  `,
    [
      entity_type,
      entity_id,
      status,
      notes,
      additional_notes,
      updated_by,
      inventory_log_id,
    ]
  )
}

// NEW: soft delete a log
async function softDeleteLog(inventory_log_id) {
  await pool.query(
    `
      UPDATE inventory_log
      SET display = FALSE, last_updated = NOW()
      WHERE inventory_log_id = $1
    `,
    [inventory_log_id]
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
