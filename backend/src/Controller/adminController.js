const userModel = require("../Model/userModel");

exports.getDashboard = (req, res) => {
  res.json({
    toast: { type: "success", message: "Admin Dashboard" },
    user: req.user,
  });
};

exports.manageUsers = (req, res) => {
  res.json({
    toast: { type: "success", message: "Manage Users - Admin Only" },
  });
};

// View List of Users
exports.listUsers = async (req, res) => {
  try {
    const { role } = req.query;
    let users;

    if (role) {
      users = await userModel.listUsersByRole(role);
    } else {
      users = await userModel.listAllUsers();
    }

    const data = users.map((u) => ({
      id: String(u.id),
      firstname: u.firstname || "",
      lastname: u.lastname || "",
      email: u.username,
      contact: u.contact || "",
      role: u.role || "",

      isactive: u.isactive === true, // added
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

exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findUserById(id);

    if (!user)
      return res
        .status(404)
        .json({ toast: { type: "error", message: "User not found" } });
    if (user.role === "admin")
      return res.status(403).json({
        toast: { type: "error", message: "Admin users cannot be blocked" },
      });

    await userModel.isInActive(id);

    // For customers, use error toast type on blocking; otherwise keep success.
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

exports.unblockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findUserById(id);

    if (!user)
      return res
        .status(404)
        .json({ toast: { type: "error", message: "User not found" } });

    await userModel.isActive(id);

    // For customers, explicitly return success toast message for unblocking.
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

// All responses already use:
// { toast: { type: "...", message: "..." }, ...otherData }
// No further backend changes needed for toast delivery.
