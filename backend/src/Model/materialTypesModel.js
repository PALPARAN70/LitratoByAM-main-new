const { pool } = require('../Config/db')

async function initMaterialTypesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS material_types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function listMaterialTypes() {
  const res = await pool.query(
    `SELECT id, name FROM material_types ORDER BY name ASC`
  )
  return res.rows
}

async function findMaterialTypeByName(name) {
  const res = await pool.query(
    `SELECT id, name FROM material_types WHERE LOWER(name)=LOWER($1)`,
    [name]
  )
  return res.rows[0] || null
}

async function createMaterialType(name) {
  const existing = await findMaterialTypeByName(name)
  if (existing) return existing
  const res = await pool.query(
    `INSERT INTO material_types (name) VALUES ($1) RETURNING id, name`,
    [name]
  )
  return res.rows[0]
}

module.exports = {
  initMaterialTypesTable,
  listMaterialTypes,
  findMaterialTypeByName,
  createMaterialType,
}
