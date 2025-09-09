require("dotenv").config();
const bcrypt = require("bcrypt");
const { pool } = require("../src/Config/db");
const { initUserTable } = require("../src/Model/userModel");

// Usage:
//   node scripts/createAdmin.js <email> <password> [firstname] [lastname]
// or set env vars ADMIN_EMAIL, ADMIN_PASSWORD and run without args

async function main() {
  const [, , argEmail, argPassword, argFirst, argLast] = process.argv;
  const email = argEmail || process.env.ADMIN_EMAIL;
  const password = argPassword || process.env.ADMIN_PASSWORD;
  const firstname = argFirst || process.env.ADMIN_FIRSTNAME || "Admin";
  const lastname = argLast || process.env.ADMIN_LASTNAME || "User";

  if (!email || !password) {
    console.error(
      "Usage: node scripts/createAdmin.js <email> <password> [firstname] [lastname]"
    );
    console.error(
      "Or set ADMIN_EMAIL and ADMIN_PASSWORD environment variables."
    );
    process.exit(1);
  }

  try {
    // Ensure table exists
    await initUserTable();

    // Check if user exists
    const existing = await pool.query(
      "SELECT id, role, is_verified FROM users WHERE username = $1",
      [email]
    );
    const hashed = await bcrypt.hash(password, 10);

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      // Update to admin, set password, mark as verified
      const update = await pool.query(
        `UPDATE users
         SET role = 'admin', password = $2, firstname = $3, lastname = $4, is_verified = TRUE, verification_token = NULL
         WHERE username = $1
         RETURNING id, username, role, is_verified, created_at`,
        [email, hashed, firstname, lastname]
      );
      console.log("Updated existing user to admin:", update.rows[0]);
    } else {
      // Insert new admin
      const insert = await pool.query(
        `INSERT INTO users (username, password, role, firstname, lastname, is_verified)
         VALUES ($1, $2, 'admin', $3, $4, TRUE)
         RETURNING id, username, role, is_verified, created_at`,
        [email, hashed, firstname, lastname]
      );
      console.log("Created admin user:", insert.rows[0]);
    }
  } catch (err) {
    console.error("Failed to create admin:", err);
    process.exitCode = 1;
  } finally {
    // Close db pool
    try {
      await pool.end();
    } catch {}
  }
}

main();
