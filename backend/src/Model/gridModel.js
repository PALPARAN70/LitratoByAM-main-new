const { pool } = require('../Config/db')
async function initGridsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS grids (
      id SERIAL PRIMARY KEY,
      grid_name VARCHAR(100) NOT NULL,
      status BOOLEAN DEFAULT TRUE,
      display BOOLEAN DEFAULT TRUE,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}
//Create Grid
async function createGrid(gridData) {
  const { grid_name, status, display, image_url } = gridData
  const result = await pool.query(
    `
    INSERT INTO grids (grid_name, status, display, image_url)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `,
    [grid_name, status, display, image_url]
  )
  return result.rows[0]
}

//Get All Grids
async function getAllGrids() {
  const result = await pool.query(`
    SELECT * FROM grids WHERE display = TRUE ORDER BY grid_name ASC
  `)
  return result.rows
}

//Update Grid
async function updateGrid(id, gridData) {
  const { grid_name, status, display, image_url } = gridData
  const result = await pool.query(
    `
    UPDATE grids
    SET grid_name = $1, status = $2, display = $3, image_url = $4, last_updated = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
  `,
    [grid_name, status, display, image_url, id]
  )
  return result.rows[0]
}

//soft delete grid by setting display to false
async function softDeleteGrid(id) {
  const result = await pool.query(
    `
    UPDATE grids
    SET display = false, last_updated = CURRENT_TIMESTAMP
    WHERE id = $1
  `,
    [id]
  )
  return result.rowCount > 0
}

// Get archived (display = FALSE)
async function getArchivedGrids() {
  const result = await pool.query(`
    SELECT * FROM grids WHERE display = FALSE ORDER BY grid_name ASC
  `)
  return result.rows
}

// Get by id regardless of display
async function getGridByIdAny(id) {
  const result = await pool.query(`SELECT * FROM grids WHERE id = $1 LIMIT 1`, [
    id,
  ])
  return result.rows[0] || null
}

module.exports = {
  initGridsTable,
  createGrid,
  updateGrid,
  softDeleteGrid,
  getAllGrids,
  getArchivedGrids,
  getGridByIdAny,
}
