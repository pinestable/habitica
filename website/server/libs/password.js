// Utilities for working with passwords
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import moment from 'moment';
import { decrypt } from './encryption';
import { model as User } from '../models/user';

const BCRYPT_SALT_ROUNDS = 10;

// Hash a plain text password
export function bcryptHash (passwordToHash) {
  return bcrypt.hash(passwordToHash, BCRYPT_SALT_ROUNDS);
}

// Check if a plain text password matches a hash
export function bcryptCompare (passwordToCheck, hashedPassword) {
  return bcrypt.compare(passwordToCheck, hashedPassword);
}

// Return the encrypted version of a password (using sha1) given a salt
export function sha1Encrypt (password, salt) {
  return crypto
    .createHmac('sha1', salt)
    .update(password)
    .digest('hex');
}

// Create a salt, default length is 10
export function sha1MakeSalt (len = 10) {
  return crypto
    .randomBytes(Math.ceil(len / 2))
    .toString('hex')
    .substring(0, len);
}

// Compare the password for a user. Works with bcrypt and sha1.
export async function compare (user, passwordToCheck) {
  if (!user || !passwordToCheck) throw new Error('user and passwordToCheck are required parameters.');

  const { passwordHashMethod, hashedPassword: passwordHash, salt: passwordSalt } = user;

  if (passwordHashMethod === 'bcrypt') {
    return bcryptCompare(passwordToCheck, passwordHash);
  }
  if (passwordHashMethod === 'sha1' || (!passwordHashMethod && passwordSalt)) {
    return passwordHash === sha1Encrypt(passwordToCheck, passwordSalt);
  }
  throw new Error('Invalid password hash method.');
}

// Convert a user to use bcrypt from sha1 for password hashing.
// Caller must save the user separately.
export async function convertToBcrypt (user, plainTextPassword) {
  if (!user || !plainTextPassword) throw new Error('user and plainTextPassword are required parameters.');

  user.salt = undefined;
  user.passwordHashMethod = 'bcrypt';
  user.hashedPassword = await bcryptHash(plainTextPassword);
}

// Returns the user if a valid password reset code is supplied, otherwise false
export async function validatePasswordResetCodeAndFindUser (code) {
  let isCodeValid = true;
  let userId;
  let user;

  try {
    const decrypted = JSON.parse(decrypt(code || 'invalid'));
    userId = decrypted.userId;
    const { expiresAt } = decrypted;
    if (moment(expiresAt).isBefore(moment())) throw new Error('expired');
  } catch (_) {
    isCodeValid = false;
  }

  if (isCodeValid) {
    user = await User.findById(userId);
    if (!user) {
      isCodeValid = false;
    } else if (code !== user.passwordResetCode) {
      isCodeValid = false;
    }
  }

  return isCodeValid ? user : false;
}
