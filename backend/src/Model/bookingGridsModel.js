const { pool } = require("../Config/db");

async function initBookingGridsTable() {
  await pool.query(`
		CREATE TABLE IF NOT EXISTS booking_request_grids (
			requestid INTEGER NOT NULL REFERENCES booking_requests(requestid) ON DELETE CASCADE,
			grid_id   INTEGER NOT NULL REFERENCES grids(id) ON DELETE RESTRICT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (requestid, grid_id)
		)
	`);
  // Helpful index for reverse lookups
  await pool
    .query(
      "CREATE INDEX IF NOT EXISTS idx_brg_grid_id ON booking_request_grids (grid_id)"
    )
    .catch(() => {});
}

// Insert 1..N grid links for a booking. Ignores duplicates safely.
async function addBookingGrids(requestid, gridIds = []) {
  if (!Array.isArray(gridIds) || gridIds.length === 0) return [];
  const q = `
		INSERT INTO booking_request_grids (requestid, grid_id)
		SELECT $1, unnest($2::int[])
		ON CONFLICT DO NOTHING
		RETURNING *
	`;
  const { rows } = await pool.query(q, [requestid, gridIds]);
  return rows;
}

// Replace all grid links for a booking with provided set (transactional)
async function setBookingGrids(requestid, gridIds = []) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM booking_request_grids WHERE requestid = $1",
      [requestid]
    );
    let rows = [];
    if (Array.isArray(gridIds) && gridIds.length) {
      const ins = `
				INSERT INTO booking_request_grids (requestid, grid_id)
				SELECT $1, unnest($2::int[])
				ON CONFLICT DO NOTHING
				RETURNING *
			`;
      const r = await client.query(ins, [requestid, gridIds]);
      rows = r.rows;
    }
    await client.query("COMMIT");
    return rows;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// Remove specific grid links, or all links if gridIds not provided
async function removeBookingGrids(requestid, gridIds = null) {
  if (Array.isArray(gridIds) && gridIds.length) {
    const q = `
			DELETE FROM booking_request_grids
			WHERE requestid = $1 AND grid_id = ANY($2::int[])
			RETURNING requestid, grid_id
		`;
    const { rows } = await pool.query(q, [requestid, gridIds]);
    return rows;
  }
  const { rowCount } = await pool.query(
    "DELETE FROM booking_request_grids WHERE requestid = $1",
    [requestid]
  );
  return rowCount;
}

// Fetch grids (with names/images) for a booking
async function getGridsForBooking(requestid) {
  const q = `
		SELECT g.id, g.grid_name, g.image_url, g.display, g.status
		FROM booking_request_grids brg
		JOIN grids g ON brg.grid_id = g.id
		WHERE brg.requestid = $1
		ORDER BY g.grid_name ASC
	`;
  const { rows } = await pool.query(q, [requestid]);
  return rows;
}

// Optional: fetch bookings that use a particular grid (useful for reporting)
async function getBookingsForGrid(gridId) {
  const q = `
		SELECT brg.requestid
		FROM booking_request_grids brg
		WHERE brg.grid_id = $1
		ORDER BY brg.requestid DESC
	`;
  const { rows } = await pool.query(q, [gridId]);
  return rows.map((r) => r.requestid);
}

// Utility: filter only visible grid ids (display=true)
async function filterVisibleGridIds(gridIds = []) {
  if (!Array.isArray(gridIds) || gridIds.length === 0) return [];
  const q = `SELECT id FROM grids WHERE id = ANY($1::int[]) AND display = TRUE`;
  const { rows } = await pool.query(q, [gridIds]);
  return rows.map((r) => r.id);
}

module.exports = {
  initBookingGridsTable,
  addBookingGrids,
  setBookingGrids,
  removeBookingGrids,
  getGridsForBooking,
  getBookingsForGrid,
  filterVisibleGridIds,
};
