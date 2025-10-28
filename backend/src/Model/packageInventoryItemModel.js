const { pool } = require('../Config/db')

// Junction table between packages and inventory items
async function initPackageInventoryItemsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS package_inventory_items (
      id SERIAL PRIMARY KEY,
      package_id INT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
      inventory_id INT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
      quantity INT NOT NULL,
      display BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}
//create package inventory item
async function createPackageInventoryItem({
  package_id,
  inventory_id,
  quantity,
}) {
  const result = await pool.query(
    `
      INSERT INTO package_inventory_items (package_id, inventory_id, quantity)
      VALUES ($1,$2,$3)
      RETURNING *
    `,
    [package_id, inventory_id, quantity]
  )
  return result.rows[0]
}
//get all package inventory items with package name and inventory material name
async function getAllPackageInventoryItems() {
  const result = await pool.query(`
    SELECT pii.*,
           p.package_name,
           i.material_name,
           i.condition,
           i.status
    FROM package_inventory_items pii
    JOIN packages p ON p.id = pii.package_id
    JOIN inventory i ON i.id = pii.inventory_id
    WHERE pii.display = TRUE
    ORDER BY p.package_name ASC, i.material_name ASC
  `)
  return result.rows
}
//update package inventory item
async function updatePackageInventoryItem(id, updates) {
  const allowed = {
    package_id: true,
    inventory_id: true,
    quantity: true,
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
    UPDATE package_inventory_items
    SET ${sets.join(', ')}
    WHERE id = $${i}
    RETURNING *
  `
  values.push(id)
  const result = await pool.query(q, values)
  return result.rows[0]
}

// NEW: get items for a specific package (visible ones)
async function getPackageInventoryItemsByPackage(package_id) {
  const result = await pool.query(
    `
      SELECT pii.*, i.material_name, i.condition, i.status
      FROM package_inventory_items pii
      JOIN inventory i ON i.id = pii.inventory_id
      WHERE pii.package_id = $1 AND pii.display = TRUE
      ORDER BY i.material_name ASC
    `,
    [package_id]
  )
  return result.rows
}

module.exports = {
  initPackageInventoryItemsTable,
  createPackageInventoryItem,
  getAllPackageInventoryItems,
  updatePackageInventoryItem,
  getPackageInventoryItemsByPackage, // NEW export
}
