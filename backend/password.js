const bcrypt = require('bcryptjs');

const saltRounds = 10;

/**
 * Encrypts (hashes) a plain text password.
 * @param {string} password - The plain password to hash.
 * @returns {Promise<string>} - The hashed password.
 */
async function encryptPassword(password) {
  const salt = await bcrypt.genSalt(saltRounds);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
}

/**
 * Compares a plain password with a hashed password.
 * @param {string} password - The plain password to compare.
 * @param {string} hashedPassword - The hashed password to compare with.
 * @returns {Promise<boolean>} - True if passwords match, false otherwise.
 */
async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Example usage
(async () => {
  const plainPassword = 'Password@123';
  const hashed = await encryptPassword(plainPassword);
  console.log('Hashed Password:', hashed);

  const isMatch = await verifyPassword(
    'Password@123',
    hashed
  );
  console.log('Password Match:', isMatch); // true

  const wrongMatch = await verifyPassword('Thejesh_12', hashed);
  console.log('Wrong Password Match:', wrongMatch); // false
})();
