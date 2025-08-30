const userModel = require('../Model/userModel')

exports.getDashboard = (req, res) => {
  res.json({ message: 'Admin Dashboard', user: req.user })
}

exports.manageUsers = (req, res) => {
  res.json({ message: 'Manage Users - Admin Only' })
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
    }))

    res.json({ users: data })
  } catch (e) {
    console.error('List Users Error:', e)
    res.status(500).json({ message: 'Internal server error' })
  }
}

//Block/Unblock Users(Admin can't be block tho)
exports.blockUnblockUser = async (req, res) => {
  try {
    const { id } = req.params
    const user = await userModel.getUserById(id)

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Admin users cannot be blocked' })
    }

    const isBlocked = user.status === 'blocked'
    await userModel.updateUserStatus(id, isBlocked ? 'active' : 'blocked')

    res.json({
      message: `User ${isBlocked ? 'unblocked' : 'blocked'} successfully`,
    })
  } catch (e) {
    console.error('Block/Unblock User Error:', e)
    res.status(500).json({ message: 'Internal server error' })
  }
}
