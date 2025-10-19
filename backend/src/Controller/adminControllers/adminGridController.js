// Grid Management Controller
// Handlers for creating, listing (active/archived), updating, and soft-deleting grids.

const gridModel = require('../../Model/gridModel')
const inventoryStatusLogModel = require('../../Model/inventoryStatusLogModel')

// Create Grid
exports.createGrid = async (req, res) => {
  try {
    const { grid_name, status, display, image_url } = req.body || {}
    if (!grid_name || !String(grid_name).trim()) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'grid_name is required' } })
    }

    const row = await gridModel.createGrid({
      grid_name: String(grid_name).trim(),
      status: status == null ? true : Boolean(status),
      display: display == null ? true : Boolean(display),
      image_url: image_url == null ? '' : String(image_url),
    })

    // Optional: auto log creation
    try {
      await inventoryStatusLogModel.createStatusLog(
        'Grid',
        Number(row.id),
        'created',
        JSON.stringify({
          changes: {
            grid_name: [null, row.grid_name],
            status: [null, row.status ? 'active' : 'inactive'],
            display: [null, row.display ? 'visible' : 'hidden'],
          },
        }),
        req.user?.id ?? null
      )
    } catch (logErr) {
      console.error('Auto log (create grid) failed:', logErr)
    }

    return res.json({
      toast: { type: 'success', message: 'Grid created successfully' },
      grid: row,
    })
  } catch (e) {
    console.error('Create Grid Error:', e)
    return res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

// List Active Grids (display = true)
exports.listGrids = async (_req, res) => {
  try {
    const rows = await gridModel.getAllGrids()
    return res.json({
      toast: { type: 'success', message: 'Grids retrieved successfully' },
      grids: rows,
    })
  } catch (e) {
    console.error('List Grids Error:', e)
    return res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

// List Archived Grids (display = false)
exports.listArchivedGrids = async (_req, res) => {
  try {
    const rows = await gridModel.getArchivedGrids()
    return res.json({
      toast: {
        type: 'success',
        message: 'Archived grids retrieved successfully',
      },
      grids: rows,
    })
  } catch (e) {
    console.error('List Archived Grids Error:', e)
    return res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

// Update Grid (partial updates supported)
exports.updateGrid = async (req, res) => {
  try {
    const { grid_id } = req.params
    const id = Number(grid_id)
    if (!Number.isFinite(id)) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'Invalid grid id' } })
    }

    const existing = await gridModel.getGridByIdAny(id)
    if (!existing) {
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'Grid not found' } })
    }

    const body = req.body || {}
    const updates = {
      grid_name:
        body.grid_name == null
          ? existing.grid_name
          : String(body.grid_name).trim(),
      status: body.status == null ? existing.status : Boolean(body.status),
      display: body.display == null ? existing.display : Boolean(body.display),
      image_url:
        body.image_url == null ? existing.image_url : String(body.image_url),
    }

    // Compute diff for logs
    const changes = {}
    const diffField = (key, format = (v) => v) => {
      const oldV = existing[key]
      const newV = updates[key]
      if (oldV !== newV) changes[key] = [format(oldV), format(newV)]
    }
    diffField('grid_name', String)
    diffField('status', (v) => (v ? 'active' : 'inactive'))
    diffField('display', (v) => (v ? 'visible' : 'hidden'))
    diffField('image_url', String)

    const updated = await gridModel.updateGrid(id, updates)

    // Determine log status
    let logStatus = 'updated'
    if ('display' in updates) {
      const was = !!existing.display
      const now = !!updates.display
      if (was === false && now === true) logStatus = 'unarchived'
      else if (was === true && now === false) logStatus = 'archived'
    }

    if (Object.keys(changes).length) {
      try {
        await inventoryStatusLogModel.createStatusLog(
          'Grid',
          id,
          logStatus,
          JSON.stringify({ changes }),
          req.user?.id ?? null
        )
      } catch (logErr) {
        console.error('Log update (grid) failed:', logErr)
      }
    }

    return res.json({
      toast: { type: 'success', message: 'Grid updated successfully' },
      grid: updated,
    })
  } catch (e) {
    console.error('Update Grid Error:', e)
    return res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

// Soft delete (display=false)
exports.deleteGrid = async (req, res) => {
  try {
    const { grid_id } = req.params
    const id = Number(grid_id)
    if (!Number.isFinite(id)) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'Invalid grid id' } })
    }

    const ok = await gridModel.softDeleteGrid(id)
    if (!ok) {
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'Grid not found' } })
    }

    try {
      await inventoryStatusLogModel.createStatusLog(
        'Grid',
        id,
        'archived',
        JSON.stringify({ changes: { display: ['visible', 'hidden'] } }),
        req.user?.id ?? null
      )
    } catch (logErr) {
      console.error('Log delete (grid) failed:', logErr)
    }

    return res.json({
      toast: { type: 'success', message: 'Grid deleted successfully' },
    })
  } catch (e) {
    console.error('Delete Grid Error:', e)
    return res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}
