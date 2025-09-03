const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const userModel = require('../Model/userModel')
const { sendEmail } = require('../Util/sendEmail')

//register function
exports.register = async (req, res) => {
  try {
    const {
      username,
      password,
      firstname,
      lastname,
      birthdate,
      sex,
      contact,
      region,
      province,
      city,
      barangay,
      postal_code,
    } = req.body

    // Validate required fields
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: 'Username and password are required' })
    }

    // Check if user exists
    const existingUser = await userModel.findUserByUsername(username)
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user (role is required, set to 'customer')
    const user = await userModel.createUser(
      username,
      hashedPassword,
      'customer',
      firstname,
      lastname,
      birthdate,
      sex,
      contact,
      region,
      province,
      city,
      barangay,
      postal_code
    )
    //email token for confirmation
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    })

    //save to database
    await userModel.setVerificationToken(user.id, token)

    //send email with link
    const baseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:5000'
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`
    // send confirmation email
    await sendEmail(
      username, // recipient (username is email in your schema)
      'Confirm your LitratoByAM account',
      `
      <h1>Welcome to LitratoByAM! 📷</h1>
      <p>Hi ${firstname || ''},</p>
      <p>Thanks for signing up. Please confirm your email address by clicking the link below:</p>
      <p><a href="${verifyUrl}" >Verify My Account</a></p>
      <br>
      <p>If you didn’t create this account, you can safely ignore this email.</p>
      <p>– The LitratoByAM Team</p>
      `
    )

    res.status(201).json({ message: 'Registration successful', user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
}

//verify email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query
    if (!token) return res.status(400).json({ message: 'Token is required' })

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await userModel.findUserByToken(token)
    if (!user)
      return res.status(400).json({ message: 'Invalid or expired token' }) //if repeated click the verify link

    await userModel.verifyUser(decoded.id)

    // await userModel.clearVerificationToken(decoded.id)

    return res.json({ message: 'Email verified successfully!' })
  } catch (err) {
    console.error(err)
    return res.status(400).json({ message: 'Invalid or expired token' })
  }
}

//login function
exports.login = async (req, res) => {
  const { username, password } = req.body
  try {
    const user = await userModel.findUserByUsername(username)
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })

    // Blocked accounts cannot login (note: column name is lowercased by Postgres)
    if (user.isactive === false) {
      return res.status(403).json({
        message: 'Your account has been blocked. Please contact support.',
      })
    }

    // Require email verification
    if (!user.is_verified) {
      return res
        .status(403)
        .json({ message: 'Please verify your email before logging in.' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid credentials' })

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    )

    res.json({
      message: 'Login successful',
      token: `Bearer ${token}`,
      role: user.role,
    })
  } catch (error) {
    console.error('Login Error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

//logout function
exports.logout = (req, res) => {
  res.json({ message: 'Logout successful' })
}

//get Profile function
exports.getProfile = async (req, res) => {
  const userId = req.user.id
  try {
    const user = await userModel.findUserById(userId)
    if (!user) return res.status(404).json({ message: 'User not found' })
    let url = '/'
    if (user.role === 'admin') url = '/admin/dashboard'
    else if (user.role === 'employee') url = '/employee/dashboard'
    else if (user.role === 'customer') url = '/customer/dashboard'

    return res.json({
      username: user.username,
      email: user.username, // using username as email for this schema
      role: user.role,
      url,
      region: user.region,
      province: user.province,
      city: user.city,
      barangay: user.barangay,
      postal_code: user.postal_code,
      contact: user.contact,
      firstname: user.firstname,
      lastname: user.lastname,
      birthdate: user.birthdate,
      sex: user.sex,
    })
  } catch (error) {
    console.error('Profile Error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

// Update current user's profile
exports.updateProfile = async (req, res) => {
  const userId = req.user.id
  try {
    const allowed = [
      'firstname',
      'lastname',
      'birthdate',
      'sex',
      'contact',
      'region',
      'province',
      'city',
      'barangay',
      'postal_code',
    ]

    const payload = {}
    for (const key of allowed) {
      if (key in req.body) payload[key] = req.body[key]
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided' })
    }

    const updated = await userModel.updateUserProfile(userId, payload)
    return res.json({ message: 'Profile updated', user: updated })
  } catch (error) {
    console.error('Update Profile Error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

//change password function
exports.changePassword = async (req, res) => {
  const userId = req.user.id
  const { oldPassword, newPassword } = req.body

  if (!oldPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: 'Old and new passwords are required' })
  }

  try {
    const user = await userModel.findUserById(userId)
    if (!user) return res.status(404).json({ message: 'User not found' })
    // compares the initial password and new password
    const isMatch = await bcrypt.compare(oldPassword, user.password)
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid old password' })

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)
    await userModel.updateUserPassword(userId, hashedNewPassword)

    res.json({ message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change Password Error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

//forgot password function
exports.forgotPassword = async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: 'Email is required' })
  }

  try {
    // Find user by email (username is email in your schema)
    const user = await userModel.findUserByUsername(email)
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Generate a password reset token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    })

    // Construct reset URL
    const frontendBase =
      process.env.FRONTEND_BASE_URL || 'http://localhost:3000'
    const resetUrl = `${frontendBase}/resetpassword?token=${encodeURIComponent(
      token
    )}` // now points to frontend page

    // Send the token via email
    await sendEmail(
      user.username, // recipient (username is email in your schema)
      'Recover your account',
      `
      <p>Hi ${user.firstname || ''},</p>
      <p>We received a request to reset your password. Please click the link below to reset it:</p>
      <p><a href="${resetUrl}">Reset My Password</a></p>
      <br>
      <p>If you didn’t do this action, you may contact our support service.</p>
      <p>– Litrato by AM</p>
      `
    )

    return res.json({ message: 'Password reset email sent' })
  } catch (error) {
    console.error('Forgot Password Error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

//reset password function
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ message: 'Token and new password are required' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await userModel.findUserById(decoded.id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Optional: ensure new != old
    const same = await bcrypt.compare(newPassword, user.password)
    if (same)
      return res.status(400).json({ message: 'Choose a different password' })

    const hashed = await bcrypt.hash(newPassword, 10)
    await userModel.updateUserPassword(user.id, hashed)

    return res.json({ message: 'Password reset successfully' })
  } catch (e) {
    console.error('Reset Password Error:', e)
    return res.status(400).json({ message: 'Invalid or expired token' })
  }
}
