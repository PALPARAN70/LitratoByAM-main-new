const { pool } = require('../Config/db')
const { initMaterialTypesTable } = require('./materialTypesModel')

// Create equipments table if not exists
async function initInventoryTable() {
  // ensure material types table exists first (independent but used logically)
  await initMaterialTypesTable()
  // rename legacy table to new equipments name if needed
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory'
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipments'
      ) THEN
        EXECUTE 'ALTER TABLE inventory RENAME TO equipments';
      END IF;
    END
    $$;
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS equipments (
      id SERIAL PRIMARY KEY,
      material_name VARCHAR(100) NOT NULL,
      material_type VARCHAR(50),
      condition VARCHAR(50) DEFAULT 'Good',
      status BOOLEAN DEFAULT TRUE,
      is_archived BOOLEAN DEFAULT FALSE,
      notes TEXT,
      display BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Ensure new schema changes exist on legacy tables
  await pool.query(
    `ALTER TABLE equipments ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`
  )

  // Backfill archive flag for legacy records that used condition='Archived'
  await pool.query(
    `UPDATE equipments
     SET is_archived = TRUE
     WHERE is_archived IS DISTINCT FROM TRUE
       AND LOWER(COALESCE(condition, '')) = 'archived'`
  )
}

// Create equipment item
async function createInventoryItem(
  materialName,
  materialType,
  condition,
  status,
  notes,
  display = true,
  isArchived = false
) {
  const baseValues = [
    materialName,
    materialType,
    condition,
    status,
    notes,
    display,
    Boolean(isArchived),
  ]

  const result = await pool.query(
    `
      INSERT INTO equipments (
        material_name,
        material_type,
        condition,
        status,
        notes,
        display,
        is_archived
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `,
    baseValues
  )
  return result.rows[0]
}

// Find by id
async function findInventoryById(id) {
  const result = await pool.query(
    `SELECT * FROM equipments WHERE id = $1 AND display = TRUE`,
    [id]
  )
  return result.rows[0]
}

// List visible items
async function getAllInventory() {
  const result = await pool.query(
    `SELECT * FROM equipments WHERE display = TRUE ORDER BY material_name ASC`
  )
  return result.rows
}

// Update inventory (whitelist fields)
async function updateInventory(id, updates) {
  if (!updates || typeof updates !== 'object') return null

  const allowed = {
    material_name: true,
    material_type: true,
    condition: true,
    status: true,
    notes: true,
    display: true,
    is_archived: true,
  }

  const fields = []
  const values = []
  let idx = 1
  for (const [k, v] of Object.entries(updates)) {
    const col = k in allowed ? k : null
    if (!col) continue
    fields.push(`${col} = $${idx}`)
    values.push(v)
    idx++
  }
  if (!fields.length) return null

  fields.push(`last_updated = CURRENT_TIMESTAMP`)

  const query = `
    UPDATE equipments
    SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING *
  `
  values.push(id)
  const result = await pool.query(query, values)
  return result.rows[0]
}

module.exports = {
  initInventoryTable,
  createInventoryItem,
  findInventoryById,
  getAllInventory,
  updateInventory,
}
