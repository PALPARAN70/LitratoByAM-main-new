// Checks JWT token for authentication
const jwt = require('jsonwebtoken')
const userModel = require('../Model/userModel')

function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1] // handles "Bearer token"
  if (!token) {
    // Check if token is provided
    return res.status(401).json({ message: 'No token provided' })
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      // If token is expired, verify signature ignoring expiration and record last_login
      if (err.name === 'TokenExpiredError') {
        try {
          const decodedIgnoreExp = jwt.verify(token, process.env.JWT_SECRET, {
            ignoreExpiration: true,
          })
          if (decodedIgnoreExp?.id) {
            try {
              await userModel.updateLastLogin(decodedIgnoreExp.id)
            } catch (e) {
              console.error('Failed to update last_login on token expiry:', e)
            }
          }
        } catch (e) {
          // ignore if signature invalid or any error occurs
        }
        return res.status(401).json({ message: 'Token expired' })
      }
      return res.status(401).json({ message: 'Failed to authenticate token' })
    }
    try {
      const user = await userModel.findUserById(decoded.id)
      if (!user || user.isactive === false) {
        return res
          .status(403)
          .json({ message: 'Account is blocked or no longer exists' })
      }
      req.user = { id: user.id, role: user.role }
      next()
    } catch (e) {
      console.error('Auth check error:', e)
      return res.status(500).json({ message: 'Server error' })
    }
  })
}

module.exports = authMiddleware // Checks JWT token for authentication
