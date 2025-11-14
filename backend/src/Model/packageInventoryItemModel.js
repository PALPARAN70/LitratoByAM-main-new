const { pool } = require('../Config/db')

// Junction table between packages and equipment items
async function initPackageInventoryItemsTable() {
  await pool.query(
    'DROP INDEX IF EXISTS package_inventory_items_unique_inventory'
  )
  await pool.query(`
    DO $$
    DECLARE
      fk_name text;
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'package_inventory_items'
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'package_equipment_items'
      ) THEN
        EXECUTE 'ALTER TABLE package_inventory_items RENAME TO package_equipment_items';
      END IF;

      SELECT c.conname INTO fk_name
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'package_equipment_items'
        AND c.contype = 'f'
        AND pg_get_constraintdef(c.oid) ILIKE '%REFERENCES inventory(%';

      IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE package_equipment_items DROP CONSTRAINT %I', fk_name);
        EXECUTE 'ALTER TABLE package_equipment_items ADD CONSTRAINT package_equipment_items_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES equipments(id) ON DELETE CASCADE';
      END IF;
    END
    $$;
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS package_equipment_items (
      id SERIAL PRIMARY KEY,
      package_id INT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
      inventory_id INT NOT NULL REFERENCES equipments(id) ON DELETE CASCADE,
      quantity INT NOT NULL,
      display BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  try {
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS package_equipment_items_unique_inventory
      ON package_equipment_items (inventory_id)
      WHERE display IS TRUE
    `)
  } catch (error) {
    console.error(
      'Ensure unique inventory assignment index failed to initialize:',
      error
    )
  }
}
//create package equipment item
async function createPackageInventoryItem({
  package_id,
  inventory_id,
  quantity,
}) {
  const result = await pool.query(
    `
      INSERT INTO package_equipment_items (package_id, inventory_id, quantity)
      VALUES ($1,$2,$3)
      RETURNING *
    `,
    [package_id, inventory_id, quantity]
  )
  return result.rows[0]
}
//get all package equipment items with package name and equipment material name
async function getAllPackageInventoryItems() {
  const result = await pool.query(`
    SELECT pii.*,
      p.package_name,
      e.material_name,
      e.condition,
      e.status,
      e.notes AS equipment_notes
    FROM package_equipment_items pii
    JOIN packages p ON p.id = pii.package_id
    JOIN equipments e ON e.id = pii.inventory_id
    WHERE pii.display = TRUE
    ORDER BY p.package_name ASC, e.material_name ASC
  `)
  return result.rows
}
//update package equipment item
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
    UPDATE package_equipment_items
    SET ${sets.join(', ')}
    WHERE id = $${i}
    RETURNING *
  `
  values.push(id)
  const result = await pool.query(q, values)
  return result.rows[0]
}

async function getPackageInventoryItemById(id) {
  const result = await pool.query(
    `
      SELECT *
      FROM package_equipment_items
      WHERE id = $1
    `,
    [id]
  )
  return result.rows[0]
}

async function getActivePackageInventoryItemByInventoryId(inventory_id) {
  const result = await pool.query(
    `
      SELECT pii.*, p.package_name
      FROM package_equipment_items pii
      JOIN packages p ON p.id = pii.package_id
      WHERE pii.inventory_id = $1 AND pii.display = TRUE
      LIMIT 1
    `,
    [inventory_id]
  )
  return result.rows[0]
}

// NEW: get items for a specific package (visible ones)
async function getPackageInventoryItemsByPackage(package_id) {
  const result = await pool.query(
    `
      SELECT
        pii.*,
        e.material_name,
        e.condition,
        e.status,
        e.notes AS equipment_notes
      FROM package_equipment_items pii
      JOIN equipments e ON e.id = pii.inventory_id
      WHERE pii.package_id = $1 AND pii.display = TRUE
      ORDER BY e.material_name ASC
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
  getPackageInventoryItemById,
  getActivePackageInventoryItemByInventoryId,
  getPackageInventoryItemsByPackage, // NEW export
}
