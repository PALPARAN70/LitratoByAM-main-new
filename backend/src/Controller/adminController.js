//----------------User Management----------------//
const userModel = require('../Model/userModel')

exports.getDashboard = (req, res) => {
  res.json({
    toast: { type: 'success', message: 'Admin Dashboard' },
    user: req.user,
  })
}

exports.manageUsers = (req, res) => {
  res.json({
    toast: { type: 'success', message: 'Manage Users - Admin Only' },
  })
}

// View List of Users
exports.listUsers = async (req, res) => {
  try {
    const { role } = req.query
    let users

    if (role) {
      users = await userModel.listUsersByRole(role)
    } else {
      users = await userModel.listAllUsers()
    }

    const data = users.map((u) => ({
      id: String(u.id),
      firstname: u.firstname || '',
      lastname: u.lastname || '',
      email: u.username,
      contact: u.contact || '',
      role: u.role || '',

      isactive: u.isactive === true, // added
    }))

    res.json({
      toast: { type: 'success', message: 'User list loaded' },
      users: data,
    })
  } catch (e) {
    console.error('List Users Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

// block and unblock user functions
exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params
    const user = await userModel.findUserById(id)

    if (!user)
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'User not found' } })
    if (user.role === 'admin')
      return res.status(403).json({
        toast: { type: 'error', message: 'Admin users cannot be blocked' },
      })

    await userModel.isInActive(id)

    // For customers, use error toast type on blocking; otherwise keep success.
    if (user.role === 'customer') {
      return res.json({
        toast: { type: 'error', message: 'Customer blocked' },
        isactive: false,
      })
    }

    return res.json({
      toast: { type: 'success', message: 'User blocked' },
      isactive: false,
    })
  } catch (e) {
    console.error('Block User Error:', e)
    return res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}
exports.unblockUser = async (req, res) => {
  try {
    const { id } = req.params
    const user = await userModel.findUserById(id)

    if (!user)
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'User not found' } })

    await userModel.isActive(id)

    // For customers, explicitly return success toast message for unblocking.
    if (user.role === 'customer') {
      return res.json({
        toast: { type: 'success', message: 'Customer unblocked' },
        isactive: true,
      })
    }

    return res.json({
      toast: { type: 'success', message: 'User unblocked' },
      isactive: true,
    })
  } catch (e) {
    console.error('Unblock User Error:', e)
    return res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}
// end of block and unblock user functions

//update user role
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params
    const { role } = req.body
    const user = await userModel.findUserById(id)

    if (!user)
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'User not found' } })
    if (user.role === 'admin')
      return res.status(403).json({
        toast: { type: 'error', message: 'Admin users cannot change roles' },
      })

    await userModel.updateUserRole(id, role)

    res.json({
      toast: { type: 'success', message: 'User role updated successfully' },
      user: { id: String(user.id), role },
    })
  } catch (e) {
    console.error('Update User Role Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}
//---------------End User Management------------------//

//----------------Inventory Management----------------//
const inventoryModel = require('../Model/inventoryModel')
const packageModel = require('../Model/packageModel')
const packageInventoryItemModel = require('../Model/packageInventoryItemModel')
const inventoryStatusLogModel = require('../Model/inventoryStatusLogModel')

//create inventory item -C
exports.createInventoryItem = async (req, res) => {
  try {
    const {
      materialName,
      materialType,
      totalQuantity,
      availableQuantity,
      condition,
      status,
      lastDateChecked,
      notes,
      display,
    } = req.body

    const newItem = await inventoryModel.createInventoryItem(
      materialName,
      materialType,
      totalQuantity,
      availableQuantity,
      condition,
      status,
      lastDateChecked,
      notes,
      display
    )

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
//used for creating inventory items
//list all inventory items -R
exports.listInventory = async (req, res) => {
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
//update inventory item -U
exports.updateInventoryItem = async (req, res) => {
  try {
    const { inventoryID } = req.params
    const updates = req.body

    await inventoryModel.updateInventory(inventoryID, updates)

    res.json({
      toast: {
        type: 'success',
        message: 'Inventory item updated successfully',
      },
    })
  } catch (e) {
    console.error('Update Inventory Item Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}
//delete inventory item by making display false -D
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

//used for creating packages which will be used in booking
//create package -C
exports.createPackage = async (req, res) => {
  try {
    const { package_name, description, price, status, display } = req.body
    const newPackage = await packageModel.createPackage(
      package_name,
      description,
      price,
      status,
      display
    )
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
//list all packages -R
exports.listPackages = async (req, res) => {
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
//update package -U
exports.updatePackage = async (req, res) => {
  try {
    const { package_id } = req.params
    const { package_name, description, price, status, display } = req.body

    //only update fields that are provided such as name, description, price, status, display
    //create updates object dynamically
    const updates = {
      ...(package_name !== undefined && { package_name }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price }),
      ...(status !== undefined && { status }),
      ...(display !== undefined && { display }),
    }
    // if no valid fields provided
    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'No valid fields provided' } })
    }
    //update package
    const updated = await packageModel.updatePackage(package_id, updates)
    if (!updated) {
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'Package not found' } })
    }
    //return success
    res.json({
      toast: { type: 'success', message: 'Package updated successfully' },
      package: updated,
    })
  } catch (e) {
    console.error('Update Package Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}
//delete package by making display false -D
exports.deletePackage = async (req, res) => {
  try {
    const { package_id } = req.params
    await packageModel.updatePackage(package_id, { display: false })
    res.json({
      toast: {
        type: 'success',
        message: 'Package deleted successfully',
      },
    })
  } catch (e) {
    console.error('Delete Package Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}

//used for creating inventory items needed for packages
//create package inventory item -C
exports.createPackageInventoryItem = async (req, res) => {
  try {
    const { package_id, inventory_id, quantity } = req.body

    if (!package_id || !inventory_id || quantity == null) {
      return res.status(400).json({
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

    const pkg = await packageModel.getPackageById(package_id)
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
      {
        package_id,
        inventory_id,
        quantity,
      }
    )

    res.status(201).json({
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
//list all package inventory items -R
exports.listPackageInventoryItems = async (req, res) => {
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
//update package inventory item -U
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
      return res.status(404).json({
        toast: { type: 'error', message: 'Item not found or no changes' },
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

// delete package inventory item (soft delete) -D
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
        .json({ toast: { type: 'error', message: 'Item not found' } })
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

//used for creating inventory status logs
//create inventory status log -C
exports.createInventoryStatusLog = async (req, res) => {
  try {
    const { entity_type, entity_id, status, notes, updated_by } = req.body
    const newLog = await inventoryStatusLogModel.createStatusLog(
      entity_type,
      entity_id,
      status,
      notes,
      updated_by
    )
    res.json({
      toast: {
        type: 'success',
        message: 'Inventory status log created successfully',
      },
      inventoryStatusLog: newLog,
    })
  } catch (e) {
    console.error('Create Inventory Status Log Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}
//list all inventory status logs -R
exports.listInventoryStatusLogs = async (req, res) => {
  try {
    const inventoryStatusLogs = await inventoryStatusLogModel.getAllLogs()
    res.json({
      toast: {
        type: 'success',
        message: 'Inventory status logs retrieved successfully',
      },
      inventoryStatusLogs,
    })
  } catch (e) {
    console.error('List Inventory Status Logs Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}
//update inventory status log -U
exports.updateInventoryStatusLog = async (req, res) => {
  try {
    const { log_id } = req.params
    const { entity_type, entity_id, status, notes, updated_by } = req.body
    await inventoryStatusLogModel.updateLog(
      log_id,
      entity_type,
      entity_id,
      status,
      notes,
      updated_by
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
//delete inventory status log by making display false -D
exports.deleteInventoryStatusLog = async (req, res) => {
  try {
    const { log_id } = req.params
    await inventoryStatusLogModel.updateLog(log_id, { display: false })
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
//----------------End Inventory Management----------------//
