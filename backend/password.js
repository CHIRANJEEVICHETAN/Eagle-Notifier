const bcrypt = require('bcryptjs');

async function hashPassword() {
  try {
    const password = "Password@123";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log("Plain Password:", password);
    console.log("Salt:", salt);
    console.log("Hashed Password:", hashedPassword);
  } catch (error) {
    console.error("Error hashing password:", error);
  }
}

hashPassword();
