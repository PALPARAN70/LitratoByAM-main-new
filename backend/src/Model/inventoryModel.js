const { pool } = require('../Config/db')
const { initMaterialTypesTable } = require('./materialTypesModel')

// Create inventory table if not exists
async function initInventoryTable() {
  // ensure material types table exists first (independent but used logically)
  await initMaterialTypesTable()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      material_name VARCHAR(100) NOT NULL,
      material_type VARCHAR(50),
      condition VARCHAR(50) DEFAULT 'Good',
      status BOOLEAN DEFAULT TRUE,
      notes TEXT,
      display BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

// Create inventory item
async function createInventoryItem(
  materialName,
  materialType,
  condition,
  status,
  notes,
  display = true
) {
  const baseValues = [
    materialName,
    materialType,
    condition,
    status,
    notes,
    display,
  ]

  const result = await pool.query(
    `
      INSERT INTO inventory (
        material_name,
        material_type,
        condition,
        status,
        notes,
        display
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `,
    baseValues
  )
  return result.rows[0]
}

// Find by id
async function findInventoryById(id) {
  const result = await pool.query(
    `SELECT * FROM inventory WHERE id = $1 AND display = TRUE`,
    [id]
  )
  return result.rows[0]
}

// List visible items
async function getAllInventory() {
  const result = await pool.query(
    `SELECT * FROM inventory WHERE display = TRUE ORDER BY material_name ASC`
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
    UPDATE inventory
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
