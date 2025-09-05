const { pool } = require('../Config/db')

// Create packages table
async function initPackagesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS packages (
      id SERIAL PRIMARY KEY,
      package_name VARCHAR(100) NOT NULL,
      description TEXT,
      price NUMERIC(10,2) DEFAULT 0.00,
      status BOOLEAN DEFAULT TRUE,
      display BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}
// Create package
async function createPackage(
  package_name,
  description,
  price,
  status = true,
  display = true
) {
  const result = await pool.query(
    `
      INSERT INTO packages (package_name, description, price, status, display)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `,
    [package_name, description, price, status, display]
  )
  return result.rows[0]
}
// Get all packages
async function getAllPackages() {
  const result = await pool.query(
    `SELECT * FROM packages WHERE display = TRUE ORDER BY package_name ASC`
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
// Update package details
async function updatePackage(id, updates) {
  const allowed = {
    package_name: true,
    description: true,
    price: true,
    status: true,
    display: true,
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
  getPackageById,
  updatePackage,
}
