// User Management Controller (split from adminController.js)
// Contains endpoints related to user administration: dashboard, listing, blocking, role updates.

const userModel = require("../../Model/userModel");
const bcrypt = require("bcrypt");

exports.getDashboard = (req, res) => {
  res.json({
    toast: { type: "success", message: "Admin Dashboard" },
    user: req.user,
  });
};

exports.manageUsers = (_req, res) => {
  res.json({
    toast: { type: "success", message: "Manage Users - Admin Only" },
  });
};

// Admin-only: Create a new user with role restricted to customer or employee
// Assumptions:
//  - Admin-created accounts are auto-verified (no email verification flow)
//  - Allowed roles: 'customer' | 'employee' (admin creation of 'admin' is not allowed here)
exports.createUser = async (req, res) => {
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
      role,
    } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        toast: {
          type: "error",
          message: "Username and password are required",
        },
      });
    }

    const existing = await userModel.findUserByUsername(username);
    if (existing) {
      return res
        .status(409)
        .json({ toast: { type: "error", message: "Username already exists" } });
    }

    // Only allow customer or employee from admin UI
    const allowedRoles = ["customer", "employee"];
    const newRole = allowedRoles.includes(role) ? role : "customer";

    const hashed = await bcrypt.hash(password, 10);
    const created = await userModel.createUser(
      username,
      hashed,
      newRole,
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
    );

    // Auto-verify admin-created users so they can log in immediately
    try {
      await userModel.verifyUser(created.id);
    } catch (e) {
      // Non-fatal: if verification update fails, still return created user
      console.warn("createUser: verifyUser failed:", e?.message);
    }

    return res.status(201).json({
      toast: { type: "success", message: "User created successfully" },
      user: {
        id: String(created.id),
        firstname: created.firstname || "",
        lastname: created.lastname || "",
        email: created.username,
        contact: created.contact || "",
        role: newRole,
        isactive: true,
        is_verified: true,
      },
    });
  } catch (e) {
    console.error("Admin createUser error:", e);
    return res
      .status(500)
      .json({ toast: { type: "error", message: "Internal server error" } });
  }
};

// Fetch a user by email (username) - admin only helper
exports.fetchUserByEmail = async (req, res) => {
  try {
    const { email } = req.query || {};
    if (!email || typeof email !== "string") {
      return res
        .status(400)
        .json({ toast: { type: "error", message: "Email is required" } });
    }

    // In our schema, username stores the email address
    const user = await userModel.findUserByUsername(email);
    if (!user || user.is_verified !== true) {
      return res
        .status(404)
        .json({ toast: { type: "error", message: "User not found" } });
    }

    return res.json({
      toast: { type: "success", message: "User fetched successfully" },
      user: {
        id: String(user.id),
        firstname: user.firstname || "",
        lastname: user.lastname || "",
        email: user.username,
        contact: user.contact || "",
        role: user.role || "",
        isactive: user.isactive === true,
        is_verified: user.is_verified === true,
      },
    });
  } catch (e) {
    console.error("Fetch User by Email Error:", e);
    return res
      .status(500)
      .json({ toast: { type: "error", message: "Internal server error" } });
  }
};

// View List of Users (optionally filter by role) - only verified users returned
exports.listUsers = async (req, res) => {
  try {
    const { role } = req.query;
    let users;

    if (role) {
      users = await userModel.listUsersByRole(role);
    } else {
      users = await userModel.listAllUsers();
    }

    const verified = users.filter((u) => u.is_verified === true);

    const data = verified.map((u) => ({
      id: String(u.id),
      firstname: u.firstname || "",
      lastname: u.lastname || "",
      email: u.username,
      contact: u.contact || "",
      role: u.role || "",
      last_login: u.last_login || null,
      last_updated: u.last_updated || null,
      isactive: u.isactive === true,
      is_verified: u.is_verified === true,
    }));

    res.json({
      toast: { type: "success", message: "User list loaded" },
      users: data,
    });
  } catch (e) {
    console.error("List Users Error:", e);
    res
      .status(500)
      .json({ toast: { type: "error", message: "Internal server error" } });
  }
};

// Block user (disallow blocking admins; customers return error toast as per legacy behavior)
exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findUserById(id);

    if (!user)
      return res
        .status(404)
        .json({ toast: { type: "error", message: "User not found" } });
    if (user.role === "admin") {
      return res.status(403).json({
        toast: { type: "error", message: "Admin users cannot be blocked" },
      });
    }

    await userModel.isInActive(id);

    if (user.role === "customer") {
      return res.json({
        toast: { type: "error", message: "Customer blocked" },
        isactive: false,
      });
    }

    return res.json({
      toast: { type: "success", message: "User blocked" },
      isactive: false,
    });
  } catch (e) {
    console.error("Block User Error:", e);
    return res
      .status(500)
      .json({ toast: { type: "error", message: "Internal server error" } });
  }
};

// Unblock user
exports.unblockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findUserById(id);

    if (!user)
      return res
        .status(404)
        .json({ toast: { type: "error", message: "User not found" } });

    await userModel.isActive(id);

    if (user.role === "customer") {
      return res.json({
        toast: { type: "success", message: "Customer unblocked" },
        isactive: true,
      });
    }

    return res.json({
      toast: { type: "success", message: "User unblocked" },
      isactive: true,
    });
  } catch (e) {
    console.error("Unblock User Error:", e);
    return res
      .status(500)
      .json({ toast: { type: "error", message: "Internal server error" } });
  }
};

// Update user role (cannot modify admins, restrict to allowed roles)
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const user = await userModel.findUserById(id);

    if (!user)
      return res
        .status(404)
        .json({ toast: { type: "error", message: "User not found" } });
    if (user.role === "admin") {
      return res.status(403).json({
        toast: { type: "error", message: "Admin users cannot change roles" },
      });
    }

    const allowedRoles = ["employee", "customer"];
    if (!role || !allowedRoles.includes(role)) {
      return res
        .status(400)
        .json({ toast: { type: "error", message: "Invalid role provided" } });
    }
    if (user.role === role) {
      return res.json({
        toast: { type: "success", message: "No role change needed" },
        user: { id: String(user.id), role },
      });
    }

    const updated = await userModel.updateUserRole(id, role);

    res.json({
      toast: { type: "success", message: "User role updated successfully" },
      user: { id: String(updated.id), role: updated.role },
    });
  } catch (e) {
    console.error("Update User Role Error:", e);
    res
      .status(500)
      .json({ toast: { type: "error", message: "Internal server error" } });
  }
};
