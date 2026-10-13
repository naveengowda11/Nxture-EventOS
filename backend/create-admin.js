const readline = require("readline");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const db = new sqlite3.Database("./nxture.db");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => {
    rl.close();
    resolve(answer.trim());
  }));
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(error) {
      if (error) reject(error);
      else resolve(this.lastID);
    });
  });
}

(async () => {
  try {
    const firstName = await ask("Admin first name: ");
    const lastName = await ask("Admin last name: ");
    const email = await ask("Admin email: ");
    const college = await ask("College name: ");
    const password = await ask("Admin password (8+ chars): ");

    if (!firstName || !lastName || !email || !college || password.length < 8) {
      throw new Error("All fields are required and password must contain at least 8 characters.");
    }

    const hash = await bcrypt.hash(password, 12);

    await run(
      `INSERT INTO users
       (first_name, last_name, email, student_id, college, department, year, designation, password_hash, role, email_verified)
       VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL, ?, 'admin', 1)`,
      [firstName, lastName, email.toLowerCase(), college, hash]
    );

    console.log("Admin account created successfully.");
  } catch (error) {
    console.error("Could not create admin:", error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
