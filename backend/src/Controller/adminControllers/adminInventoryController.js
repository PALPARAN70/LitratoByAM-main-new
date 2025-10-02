// Inventory & Package Management Controller (split from adminController.js)
// Contains endpoints related to inventory items, packages, package inventory junctions,
// material types, and inventory status logs.

const inventoryModel = require('../../Model/inventoryModel')
const packageModel = require('../../Model/packageModel')
const packageInventoryItemModel = require('../../Model/packageInventoryItemModel')
const inventoryStatusLogModel = require('../../Model/inventoryStatusLogModel')
const materialTypesModel = require('../../Model/materialTypesModel')

// -------- Inventory Items -------- //
exports.createInventoryItem = async (req, res) => {
  try {
    const {
      materialName,
      materialType,
      condition,
      status,
      lastDateChecked,
      notes,
      display,
    } = req.body

    const newItem = await inventoryModel.createInventoryItem(
      materialName,
      materialType,
      condition,
      status,
      lastDateChecked,
      notes,
      display
    )

    // auto log
    try {
      await inventoryStatusLogModel.createStatusLog(
        'Inventory',
        Number(newItem.id),
        'created',
        JSON.stringify({
          changes: {
            material_name: [null, newItem.material_name],
            material_type: [null, newItem.material_type],
            condition: [null, newItem.condition],
            status: [null, newItem.status ? 'available' : 'unavailable'],
          },
        }),
        req.user?.id ?? null
      )
    } catch (logErr) {
      console.error('Auto log (create inventory) failed:', logErr)
    }

    res.json({
      toast: {
        type: 'success',
        message: 'Inventory item created successfully',
      },
      item: newItem,
    })
  } catch (e) {
    console.error('Create Inventory Item Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.listInventory = async (_req, res) => {
  try {
    const items = await inventoryModel.getAllInventory()
    res.json({
      toast: {
        type: 'success',
        message: 'Inventory items retrieved successfully',
      },
      items,
    })
  } catch (e) {
    console.error('List Inventory Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.updateInventoryItem = async (req, res) => {
  try {
    const { inventoryID } = req.params
    const updates = req.body
    const current = await inventoryModel.findInventoryById(inventoryID)
    if (!current) {
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'Inventory item not found' } })
    }

    const updated = await inventoryModel.updateInventory(inventoryID, updates)

    // build diff
    const diff = {}
    const trackFields = [
      'material_name',
      'material_type',
      'condition',
      'status',
    ]
    for (const f of trackFields) {
      if (Object.prototype.hasOwnProperty.call(updates, f)) {
        const oldVal = current[f]
        const newVal = updated ? updated[f] : undefined
        if (oldVal !== newVal) {
          const normalize = (field, val) => {
            if (field === 'status') return val ? 'available' : 'unavailable'
            return val === null || val === undefined ? null : String(val)
          }
          diff[f] = [normalize(f, oldVal), normalize(f, newVal)]
        }
      }
    }
    if (Object.keys(diff).length) {
      try {
        await inventoryStatusLogModel.createStatusLog(
          'Inventory',
          Number(inventoryID),
          'updated',
          JSON.stringify({ changes: diff }),
          req.user?.id ?? null
        )
      } catch (logErr) {
        console.error('Auto log (update inventory) failed:', logErr)
      }
    }

    res.json({
      toast: {
        type: 'success',
        message: 'Inventory item updated successfully',
      },
      item: updated,
    })
  } catch (e) {
    console.error('Update Inventory Item Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.deleteInventoryItem = async (req, res) => {
  try {
    const { inventoryID } = req.params
    await inventoryModel.updateInventory(inventoryID, { display: false })
    res.json({
      toast: {
        type: 'success',
        message: 'Inventory item deleted successfully',
      },
    })
  } catch (e) {
    console.error('Delete Inventory Item Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

// -------- Material Types -------- //
exports.listMaterialTypes = async (_req, res) => {
  try {
    const rows = await materialTypesModel.listMaterialTypes()
    res.json({ materialTypes: rows })
  } catch (e) {
    console.error('List material types error:', e)
    res.status(500).json({ error: 'Internal server error' })
  }
}

exports.createMaterialType = async (req, res) => {
  try {
    const { name } = req.body || {}
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }
    const row = await materialTypesModel.createMaterialType(String(name).trim())
    res.json({ materialType: row })
  } catch (e) {
    console.error('Create material type error:', e)
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Type already exists' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

// -------- Packages -------- //
exports.createPackage = async (req, res) => {
  try {
    const { package_name, description, price, status, display, image_url } =
      req.body
    const newPackage = await packageModel.createPackage(
      package_name,
      description,
      price,
      status,
      display,
      image_url
    )
    try {
      await inventoryStatusLogModel.createStatusLog(
        'Package',
        Number(newPackage.id),
        'created',
        JSON.stringify({
          changes: {
            package_name: [null, newPackage.package_name],
            price: [null, String(newPackage.price)],
            status: [null, newPackage.status ? 'active' : 'inactive'],
            display: [null, newPackage.display ? 'visible' : 'hidden'],
          },
        }),
        req.user?.id ?? null
      )
    } catch (logErr) {
      console.error('Auto log (create package) failed:', logErr)
    }
    res.json({
      toast: { type: 'success', message: 'Package created successfully' },
      package: newPackage,
    })
  } catch (e) {
    console.error('Create Package Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.listPackages = async (_req, res) => {
  try {
    const packages = await packageModel.getAllPackages()
    res.json({
      toast: { type: 'success', message: 'Packages retrieved successfully' },
      packages,
    })
  } catch (e) {
    console.error('List Packages Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.listArchivedPackages = async (_req, res) => {
  try {
    const packages = await packageModel.getArchivedPackages()
    res.json({
      toast: {
        type: 'success',
        message: 'Archived packages retrieved successfully',
      },
      packages,
    })
  } catch (e) {
    console.error('List Archived Packages Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.updatePackage = async (req, res) => {
  try {
    const { package_id } = req.params
    const id = Number(package_id)
    if (!Number.isFinite(id)) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'Invalid package id' } })
    }

    const existing = await packageModel.getPackageByIdAny(id)
    if (!existing) {
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'Package not found' } })
    }

    const body = req.body || {}
    const updates = {}

    if (Object.prototype.hasOwnProperty.call(body, 'package_name')) {
      const v = String(body.package_name ?? '').trim()
      if (v !== '') updates.package_name = v
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      updates.description =
        body.description == null ? '' : String(body.description)
    }
    if (Object.prototype.hasOwnProperty.call(body, 'price')) {
      const n = Number(body.price)
      if (Number.isFinite(n)) updates.price = n
    }
    if (Object.prototype.hasOwnProperty.call(body, 'image_url')) {
      updates.image_url = body.image_url == null ? '' : String(body.image_url)
    }
    if (Object.prototype.hasOwnProperty.call(body, 'display')) {
      updates.display = Boolean(body.display)
    }

    if (Object.keys(updates).length === 0) {
      return res.json({
        toast: { type: 'success', message: 'No changes detected' },
        package: existing,
      })
    }

    const changes = {}
    const allowed = [
      'package_name',
      'description',
      'price',
      'image_url',
      'display',
    ]
    for (const k of allowed) {
      if (!(k in updates)) continue
      const oldV = existing[k]
      const newV = updates[k]
      if (k === 'display') {
        const oldDisp = !!oldV
        const newDisp = !!newV
        if (oldDisp !== newDisp) {
          changes.display = [
            oldDisp ? 'visible' : 'hidden',
            newDisp ? 'visible' : 'hidden',
          ]
        }
      } else {
        const oldStr = oldV == null ? '' : String(oldV)
        const newStr = newV == null ? '' : String(newV)
        if (oldStr !== newStr) {
          if (k === 'image_url') {
            changes[k] = ['changed', 'changed']
          } else {
            changes[k] = [oldStr, newStr]
          }
        }
      }
    }

    const updated = await packageModel.updatePackage(id, updates)

    let logStatus = 'updated'
    if ('display' in updates) {
      const was = !!existing.display
      const now = !!updates.display
      if (was === false && now === true) logStatus = 'unarchived'
      else if (was === true && now === false) logStatus = 'archived'
    }

    if (Object.keys(changes).length > 0) {
      await inventoryStatusLogModel.createStatusLog(
        'Package',
        id,
        logStatus,
        JSON.stringify({ changes }),
        req.user?.id ?? null
      )
    }

    return res.json({
      toast: { type: 'success', message: 'Package updated successfully' },
      package: updated,
    })
  } catch (e) {
    console.error('Update Package Error:', e)
    return res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.deletePackage = async (req, res) => {
  try {
    const { package_id } = req.params
    await packageModel.updatePackage(package_id, { display: false })
    res.json({
      toast: { type: 'success', message: 'Package deleted successfully' },
    })
  } catch (e) {
    console.error('Delete Package Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

// -------- Package Inventory Items -------- //
exports.createPackageInventoryItem = async (req, res) => {
  try {
    const { package_id, inventory_id, quantity } = req.body

    if (!package_id || !inventory_id || quantity == null) {
      return res
        .status(400)
        .json({
          toast: {
            type: 'error',
            message: 'package_id, inventory_id, quantity required',
          },
        })
    }
    if (quantity <= 0) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'Quantity must be > 0' } })
    }

    const pkg = await packageModel.getPackageByIdAny(package_id)
    if (!pkg) {
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'Package not found' } })
    }

    const inv = await inventoryModel.findInventoryById(inventory_id)
    if (!inv) {
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'Inventory item not found' } })
    }

    const junction = await packageInventoryItemModel.createPackageInventoryItem(
      { package_id, inventory_id, quantity }
    )

    res
      .status(201)
      .json({
        toast: { type: 'success', message: 'Package inventory item created' },
        packageInventoryItem: junction,
      })
  } catch (error) {
    console.error('Create Package Inventory Item Error:', error)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.listPackageInventoryItems = async (_req, res) => {
  try {
    const packageInventoryItems =
      await packageInventoryItemModel.getAllPackageInventoryItems()
    res.json({
      toast: {
        type: 'success',
        message: 'Package inventory items retrieved successfully',
      },
      packageInventoryItems,
    })
  } catch (e) {
    console.error('List Package Inventory Items Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.updatePackageInventoryItem = async (req, res) => {
  try {
    const { package_inventory_item_id } = req.params
    const { package_id, inventory_id, quantity, display } = req.body

    const updates = {
      ...(package_id !== undefined && { package_id }),
      ...(inventory_id !== undefined && { inventory_id }),
      ...(quantity !== undefined && { quantity }),
      ...(display !== undefined && { display }),
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'No valid fields provided' } })
    }

    const updated = await packageInventoryItemModel.updatePackageInventoryItem(
      package_inventory_item_id,
      updates
    )
    if (!updated) {
      return res
        .status(404)
        .json({
          toast: { type: 'error', message: 'Package inventory item not found' },
        })
    }

    res.json({
      toast: {
        type: 'success',
        message: 'Package inventory item updated successfully',
      },
      packageInventoryItem: updated,
    })
  } catch (e) {
    console.error('Update Package Inventory Item Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.deletePackageInventoryItem = async (req, res) => {
  try {
    const { package_inventory_item_id } = req.params
    const updated = await packageInventoryItemModel.updatePackageInventoryItem(
      package_inventory_item_id,
      { display: false }
    )
    if (!updated) {
      return res
        .status(404)
        .json({
          toast: { type: 'error', message: 'Package inventory item not found' },
        })
    }
    res.json({
      toast: {
        type: 'success',
        message: 'Package inventory item deleted successfully',
      },
    })
  } catch (e) {
    console.error('Delete Package Inventory Item Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

// -------- Inventory Status Logs -------- //
exports.createInventoryStatusLog = async (req, res) => {
  try {
    const { entity_type, entity_id, status, notes } = req.body
    if (!entity_type || entity_id == null || !status) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'Missing required fields' } })
    }
    const updater = req.user?.id ?? null
    await inventoryStatusLogModel.createStatusLog(
      String(entity_type),
      Number(entity_id),
      String(status),
      notes ?? null,
      updater
    )
    res.json({
      toast: {
        type: 'success',
        message: 'Inventory status log created successfully',
      },
    })
  } catch (e) {
    console.error('Create Inventory Status Log Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.listInventoryStatusLogs = async (_req, res) => {
  try {
    const rows = await inventoryStatusLogModel.getAllLogs()
    res.json({
      toast: {
        type: 'success',
        message: 'Inventory status logs retrieved successfully',
      },
      inventoryStatusLogs: rows,
    })
  } catch (e) {
    console.error('List Inventory Status Logs Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.listInventoryStatusLogsByEntity = async (req, res) => {
  try {
    const { entity_type, entity_id } = req.query
    if (!entity_type || !entity_id) {
      return res
        .status(400)
        .json({
          toast: {
            type: 'error',
            message: 'entity_type and entity_id required',
          },
        })
    }
    const rows = await inventoryStatusLogModel.findLogsByEntity(
      String(entity_type),
      Number(entity_id)
    )
    res.json({
      toast: {
        type: 'success',
        message: 'Inventory status logs retrieved successfully',
      },
      inventoryStatusLogs: rows,
    })
  } catch (e) {
    console.error('List Inventory Status Logs By Entity Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.updateInventoryStatusLog = async (req, res) => {
  try {
    const { log_id } = req.params
    const { entity_type, entity_id, status, notes } = req.body
    if (!log_id) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'log_id is required' } })
    }
    if (!entity_type || entity_id == null || !status) {
      return res
        .status(400)
        .json({
          toast: {
            type: 'error',
            message: 'entity_type, entity_id, and status are required',
          },
        })
    }
    const updater = req.user?.id ?? null
    await inventoryStatusLogModel.updateLog(
      Number(log_id),
      String(entity_type),
      Number(entity_id),
      String(status),
      notes ?? null,
      updater
    )
    res.json({
      toast: {
        type: 'success',
        message: 'Inventory status log updated successfully',
      },
    })
  } catch (e) {
    console.error('Update Inventory Status Log Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.deleteInventoryStatusLog = async (req, res) => {
  try {
    const { log_id } = req.params
    await inventoryStatusLogModel.softDeleteLog(log_id)
    res.json({
      toast: {
        type: 'success',
        message: 'Inventory status log deleted successfully',
      },
    })
  } catch (e) {
    console.error('Delete Inventory Status Log Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

// -------- Package Items for Package + Replacement -------- //
exports.listPackageItemsForPackage = async (req, res) => {
  try {
    const { package_id } = req.params
    const packageId = Number(package_id)

    if (!Number.isFinite(packageId)) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'Invalid package ID' } })
    }

    const pkg = await packageModel.getPackageByIdAny(packageId)
    if (!pkg) {
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'Package not found' } })
    }

    const all = await packageInventoryItemModel.getAllPackageInventoryItems()
    const items = all.filter(
      (it) => Number(it.package_id) === packageId && it.display !== false
    )

    res.json({
      toast: {
        type: 'success',
        message: 'Package items retrieved successfully',
      },
      items,
    })
  } catch (e) {
    console.error('List Package Items For Package Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

exports.replacePackageItems = async (req, res) => {
  try {
    const { package_id } = req.params
    const packageId = Number(package_id)
    const items = Array.isArray(req.body?.items) ? req.body.items : null

    if (!Number.isFinite(packageId)) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'Invalid package ID' } })
    }
    if (!items) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'Items array is required' } })
    }

    const pkg = await packageModel.getPackageByIdAny(packageId)
    if (!pkg) {
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'Package not found' } })
    }

    const all = await packageInventoryItemModel.getAllPackageInventoryItems()
    const existing = all.filter(
      (it) => Number(it.package_id) === packageId && it.display !== false
    )
    for (const it of existing) {
      await packageInventoryItemModel.updatePackageInventoryItem(it.id, {
        display: false,
      })
    }

    const newItems = []
    for (const item of items) {
      const { inventory_id, quantity } = item
      if (!inventory_id || quantity == null) {
        return res
          .status(400)
          .json({
            toast: {
              type: 'error',
              message: 'inventory_id and quantity are required',
            },
          })
      }
      if (quantity <= 0) {
        return res
          .status(400)
          .json({ toast: { type: 'error', message: 'Quantity must be > 0' } })
      }

      const inv = await inventoryModel.findInventoryById(inventory_id)
      if (!inv) {
        return res
          .status(404)
          .json({
            toast: { type: 'error', message: 'Inventory item not found' },
          })
      }

      const junction =
        await packageInventoryItemModel.createPackageInventoryItem({
          package_id: packageId,
          inventory_id,
          quantity,
        })
      newItems.push(junction)
    }

    res.json({
      toast: {
        type: 'success',
        message: 'Package items replaced successfully',
      },
      items: newItems,
    })
  } catch (e) {
    console.error('Replace Package Items Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}
