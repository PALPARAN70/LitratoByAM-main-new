// User Management Controller (split from adminController.js)
// Contains endpoints related to user administration: dashboard, listing, blocking, role updates.

const userModel = require('../../Model/userModel')

exports.getDashboard = (req, res) => {
  res.json({
    toast: { type: 'success', message: 'Admin Dashboard' },
    user: req.user,
  })
}

exports.manageUsers = (_req, res) => {
  res.json({
    toast: { type: 'success', message: 'Manage Users - Admin Only' },
  })
}

// View List of Users (optionally filter by role) - only verified users returned
exports.listUsers = async (req, res) => {
  try {
    const { role } = req.query
    let users

    if (role) {
      users = await userModel.listUsersByRole(role)
    } else {
      users = await userModel.listAllUsers()
    }

    const verified = users.filter((u) => u.is_verified === true)

    const data = verified.map((u) => ({
      id: String(u.id),
      firstname: u.firstname || '',
      lastname: u.lastname || '',
      email: u.username,
      contact: u.contact || '',
      role: u.role || '',
      last_login: u.last_login || null,
      last_updated: u.last_updated || null,
      isactive: u.isactive === true,
      is_verified: u.is_verified === true,
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

// Block user (disallow blocking admins; customers return error toast as per legacy behavior)
exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params
    const user = await userModel.findUserById(id)

    if (!user)
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'User not found' } })
    if (user.role === 'admin') {
      return res.status(403).json({
        toast: { type: 'error', message: 'Admin users cannot be blocked' },
      })
    }

    await userModel.isInActive(id)

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

// Unblock user
exports.unblockUser = async (req, res) => {
  try {
    const { id } = req.params
    const user = await userModel.findUserById(id)

    if (!user)
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'User not found' } })

    await userModel.isActive(id)

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

// Update user role (cannot modify admins, restrict to allowed roles)
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params
    const { role } = req.body
    const user = await userModel.findUserById(id)

    if (!user)
      return res
        .status(404)
        .json({ toast: { type: 'error', message: 'User not found' } })
    if (user.role === 'admin') {
      return res.status(403).json({
        toast: { type: 'error', message: 'Admin users cannot change roles' },
      })
    }

    const allowedRoles = ['employee', 'customer']
    if (!role || !allowedRoles.includes(role)) {
      return res
        .status(400)
        .json({ toast: { type: 'error', message: 'Invalid role provided' } })
    }
    if (user.role === role) {
      return res.json({
        toast: { type: 'success', message: 'No role change needed' },
        user: { id: String(user.id), role },
      })
    }

    const updated = await userModel.updateUserRole(id, role)

    res.json({
      toast: { type: 'success', message: 'User role updated successfully' },
      user: { id: String(updated.id), role: updated.role },
    })
  } catch (e) {
    console.error('Update User Role Error:', e)
    res
      .status(500)
      .json({ toast: { type: 'error', message: 'Internal server error' } })
  }
}
