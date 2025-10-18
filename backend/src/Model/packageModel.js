const { pool } = require('../Config/db')

// Create packages table
async function initPackagesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS packages (
      id SERIAL PRIMARY KEY,
      package_name VARCHAR(100) NOT NULL,
      description TEXT,
      price NUMERIC(10,2) DEFAULT 0.00,
      duration_hours INTEGER,
      status BOOLEAN DEFAULT TRUE,
      display BOOLEAN DEFAULT TRUE,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  // Migration: add missing column if table already exists
  await pool
    .query(
      'ALTER TABLE packages ADD COLUMN IF NOT EXISTS duration_hours INTEGER'
    )
    .catch(() => {})
}
// Create package
async function createPackage(
  package_name,
  description,
  price,
  duration_hours = null,
  status = true,
  display = true,
  image_url = null
) {
  const query = `
    INSERT INTO packages (package_name, description, price, duration_hours, status, display, image_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `
  const values = [
    package_name,
    description,
    price,
    duration_hours,
    status,
    display,
    image_url,
  ]
  const { rows } = await pool.query(query, values)
  return rows[0]
}
// Get all packages
async function getAllPackages() {
  const result = await pool.query(
    `SELECT * FROM packages WHERE display = TRUE ORDER BY package_name ASC`
  )
  return result.rows
}
// Get archived (hidden) packages
async function getArchivedPackages() {
  const result = await pool.query(
    `SELECT * FROM packages WHERE display = FALSE ORDER BY package_name ASC`
  )
  return result.rows
}
// Get package by ID
async function getPackageById(id) {
  const result = await pool.query(
    `SELECT * FROM packages WHERE id = $1 AND display = TRUE`,
    [id]
  )
  return result.rows[0]
}
// Get package by ID ignoring display (used for diff when un-archiving)
async function getPackageByIdAny(id) {
  const result = await pool.query(`SELECT * FROM packages WHERE id = $1`, [id])
  return result.rows[0]
}
// Update package details
async function updatePackage(id, updates) {
  const allowed = {
    package_name: true,
    description: true,
    price: true,
    duration_hours: true,
    status: true,
    display: true,
    image_url: true,
  }
  const sets = []
  const values = []
  let i = 1
  for (const [k, v] of Object.entries(updates || {})) {
    if (!allowed[k]) continue
    sets.push(`${k} = $${i}`)
    values.push(v)
    i++
  }
  if (!sets.length) return null
  sets.push(`last_updated = CURRENT_TIMESTAMP`)
  const q = `
    UPDATE packages
    SET ${sets.join(', ')}
    WHERE id = $${i}
    RETURNING *
  `
  values.push(id)
  const result = await pool.query(q, values)
  return result.rows[0]
}

module.exports = {
  initPackagesTable,
  createPackage,
  getAllPackages,
  getArchivedPackages,
  getPackageById,
  getPackageByIdAny,
  updatePackage,
}
