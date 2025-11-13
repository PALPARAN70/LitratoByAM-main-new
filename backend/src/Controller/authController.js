const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const userModel = require('../Model/userModel')
const { sendEmail } = require('../Util/sendEmail')

function buildFrontendUrl(path) {
  const base = process.env.FRONTEND_BASE_URL || 'http://localhost:3000'
  const sanitizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  return `${sanitizedBase}${path}`
}

function createSuccessHtml(loginUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Email Verified</title>
<style>
  body { font-family: Arial, sans-serif; background-color: #f3f4f6; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #ffffff; padding: 32px; border-radius: 16px; box-shadow: 0 12px 30px rgba(17, 24, 39, 0.12); max-width: 480px; text-align: center; }
  .title { font-size: 28px; margin-bottom: 12px; color: #111827; }
  .message { color: #374151; margin-bottom: 24px; }
  .cta { display: inline-block; padding: 12px 24px; background: #111827; color: #ffffff; border-radius: 9999px; text-decoration: none; font-weight: 600; }
  .cta:hover { background: #000000; }
  .secondary { margin-top: 16px; color: #6b7280; font-size: 14px; }
</style>
</head>
<body>
  <div class="card">
    <h1 class="title">Email Verified</h1>
    <p class="message">Thanks for confirming your email. Your LitratoByAM account is now active.</p>
    <a class="cta" href="${loginUrl}">Continue to Login</a>
    <p class="secondary">You will be redirected shortly.</p>
  </div>
  <script>
    setTimeout(function () {
      window.location.href = '${loginUrl}';
    }, 4000);
  </script>
</body>
</html>`
}

function createErrorHtml(loginUrl, detail) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Verification Link Invalid</title>
<style>
  body { font-family: Arial, sans-serif; background-color: #f3f4f6; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #ffffff; padding: 32px; border-radius: 16px; box-shadow: 0 12px 30px rgba(17, 24, 39, 0.12); max-width: 480px; text-align: center; }
  .title { font-size: 26px; margin-bottom: 12px; color: #111827; }
  .message { color: #374151; margin-bottom: 24px; }
  .cta { display: inline-block; padding: 12px 24px; background: #111827; color: #ffffff; border-radius: 9999px; text-decoration: none; font-weight: 600; }
  .cta:hover { background: #000000; }
  .secondary { margin-top: 16px; color: #6b7280; font-size: 14px; }
</style>
</head>
<body>
  <div class="card">
    <h1 class="title">Verification Link Invalid</h1>
    <p class="message">${detail}</p>
    <a class="cta" href="${loginUrl}">Return to Login</a>
    <p class="secondary">Request a new verification email from the login page if needed.</p>
  </div>
</body>
</html>`
}

function sendFormatted(res, statusCode, html, jsonPayload) {
  res.format({
    'text/html': () => res.status(statusCode).send(html),
    'application/json': () => res.status(statusCode).json(jsonPayload),
    default: () =>
      res
        .status(statusCode)
        .type('application/json')
        .send(JSON.stringify(jsonPayload)),
  })
}

function createVerificationToken(userId) {
  const expiresIn = process.env.VERIFICATION_TOKEN_EXPIRY || '3h'
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn,
  })
}

function buildVerificationUrl(token) {
  const baseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:5000'
  const sanitized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  return `${sanitized}/api/auth/verify?token=${token}`
}

function composeVerificationEmail(firstname, verifyUrl) {
  const displayName = firstname ? `Hi ${firstname},` : 'Hello,'
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@litrato.com'
  return `
      <div style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.6;">
        <h1 style="margin-bottom: 0.5rem;">Welcome to LitratoByAM</h1>
        <p style="margin: 0 0 1rem;">${displayName}</p>
        <p style="margin: 0 0 1rem;">
          Thanks for joining our community. Please confirm your email address so we can secure your account and keep you in the loop about your bookings.
        </p>
        <p style="margin: 0 0 1.5rem;">
          <a
            href="${verifyUrl}"
            style="display: inline-block; padding: 0.75rem 1.5rem; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 9999px; font-weight: 600;"
          >
            Verify My Account
          </a>
        </p>
        <p style="margin: 0 0 1rem;">
          This link is time-limited. If the button does not work, copy and paste the URL below into your browser:
        </p>
        <p style="margin: 0 0 1.5rem; word-break: break-word;">
          <a href="${verifyUrl}" style="color: #2563eb;">${verifyUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #d1d5db; margin: 1.5rem 0;" />
        <p style="margin: 0 0 0.75rem;">If you did not create this account, please ignore this email. Your account will remain inactive until verified.</p>
        <p style="margin: 0 0 0.75rem;">
          Need help? Reply to this message or reach us at <a href="mailto:${supportEmail}" style="color: #2563eb;">${supportEmail}</a>.
        </p>
        <p style="margin: 0;">- The LitratoByAM Team</p>
      </div>
    `
}

async function sendVerificationEmail(username, firstname, verifyUrl) {
  const emailBody = composeVerificationEmail(firstname, verifyUrl)
  await sendEmail(username, 'Confirm your LitratoByAM account', emailBody)
}

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
    const token = createVerificationToken(user.id)

    //save to database
    await userModel.setVerificationToken(user.id, token)

    //send email with link
    const verifyUrl = buildVerificationUrl(token)
    await sendVerificationEmail(username, firstname, verifyUrl)

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
    const loginUrl = buildFrontendUrl('/login')
    if (!token) {
      const html = createErrorHtml(loginUrl, 'Missing verification token.')
      return sendFormatted(res, 400, html, { message: 'Token is required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await userModel.findUserByToken(token)
    if (!user) {
      const html = createErrorHtml(
        loginUrl,
        'This verification link is invalid or has expired.'
      )
      return sendFormatted(res, 400, html, {
        message: 'Invalid or expired token',
      })
    }

    await userModel.verifyUser(decoded.id)

    const html = createSuccessHtml(loginUrl)
    return sendFormatted(res, 200, html, {
      message: 'Email verified successfully!',
    })
  } catch (err) {
    console.error(err)
    const loginUrl = buildFrontendUrl('/login')
    const html = createErrorHtml(
      loginUrl,
      'This verification link is invalid or has expired.'
    )
    return sendFormatted(res, 400, html, {
      message: 'Invalid or expired token',
    })
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
      let reason = 'verification_pending'
      let message = 'Please verify your email before logging in.'
      let tokenExpired = false

      if (!user.verification_token) {
        tokenExpired = true
      } else {
        try {
          jwt.verify(user.verification_token, process.env.JWT_SECRET)
        } catch (error) {
          tokenExpired = true
        }
      }

      if (tokenExpired) {
        reason = 'verification_expired'
        message =
          'Your verification link has expired. Request a new email from the login page.'
      }

      return res.status(403).json({ message, reason })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid credentials' })

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    try {
      await userModel.updateLastLogin(user.id)
    } catch {}

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
exports.logout = async (req, res) => {
  try {
    await userModel.updateLastLogin(req.user.id)
  } catch (e) {
    // don't fail logout if logging last_login fails
    console.error('Failed to update last_login on logout:', e)
  }
  res.json({ message: 'Logout successful' })
}

//get Profile function
exports.getProfile = async (req, res) => {
  const userId = req.user.id
  try {
    const user = await userModel.findUserById(userId)
    if (!user) return res.status(404).json({ message: 'User not found' })
    let url = '/'
    if (user.role === 'admin') url = '/admin'
    else if (user.role === 'employee') url = '/staff'
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

// resend verification email when original token expires
exports.resendVerificationEmail = async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: 'Email is required' })
  }

  try {
    const user = await userModel.findUserByUsername(email)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (user.is_verified) {
      return res
        .status(400)
        .json({ message: 'This account is already verified.' })
    }

    const token = createVerificationToken(user.id)
    await userModel.setVerificationToken(user.id, token)

    const verifyUrl = buildVerificationUrl(token)
    await sendVerificationEmail(user.username, user.firstname, verifyUrl)

    return res.json({
      message: 'Verification email sent. Please check your inbox.',
    })
  } catch (error) {
    console.error('Resend Verification Error:', error)
    return res
      .status(500)
      .json({ message: 'Failed to resend verification email' })
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
