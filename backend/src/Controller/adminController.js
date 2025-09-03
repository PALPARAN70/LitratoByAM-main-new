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

exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params
    const user = await userModel.findUserById(id)

    if (!user) return res.status(404).json({ message: 'User not found' })
    if (user.role === 'admin')
      return res.status(403).json({ message: 'Admin users cannot be blocked' })

    await userModel.isInActive(id)

    return res.json({ message: 'User blocked', is_verified: false })
  } catch (e) {
    console.error('Block User Error:', e)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

exports.unblockUser = async (req, res) => {
  try {
    const { id } = req.params
    const user = await userModel.findUserById(id)

    if (!user) return res.status(404).json({ message: 'User not found' })

    await userModel.isActive(id)

    return res.json({ message: 'User unblocked', is_verified: true })
  } catch (e) {
    console.error('Unblock User Error:', e)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
