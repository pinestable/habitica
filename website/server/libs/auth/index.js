import {
  BadRequest,
  NotAuthorized,
} from '../errors';
import * as passwordUtils from '../password';
import { model as User } from '../../models/user';
import common from '../../../common';
import { verifyUsername } from '../user/validation';

export { loginRes } from './utils';

// Stub exports for compatibility with files that import these names
export function hasLocalAuth (user) {
  return Boolean(user.email && user.hashedPassword);
}

export function hasBackupAuth () { return true; }
export function loginSocial () {
  throw new NotAuthorized('Social login is not available.');
}
export function socialEmailToLocal () {
  throw new NotAuthorized('Social login is not available.');
}

const USERNAME_LENGTH_MIN = 1;
const USERNAME_LENGTH_MAX = 20;

export async function registerLocal (req, res, { isV3 = false } = {}) {
  req.checkBody({
    username: {
      notEmpty: true,
      errorMessage: res.t('missingUsername'),
      isLength: {
        options: { min: USERNAME_LENGTH_MIN, max: USERNAME_LENGTH_MAX },
        errorMessage: res.t('usernameIssueLength'),
      },
      matches: {
        options: /^[-_a-zA-Z0-9]+$/,
        errorMessage: res.t('usernameIssueInvalidCharacters'),
      },
    },
    email: {
      notEmpty: true,
      errorMessage: res.t('missingEmail'),
      isEmail: { errorMessage: res.t('notAnEmail') },
    },
    password: {
      notEmpty: true,
      errorMessage: res.t('missingPassword'),
      equals: {
        options: [req.body.confirmPassword],
        errorMessage: res.t('passwordConfirmationMatch'),
      },
      isLength: {
        options: {
          min: common.constants.MINIMUM_PASSWORD_LENGTH,
          max: common.constants.MAXIMUM_PASSWORD_LENGTH,
        },
        errorMessage: res.t('passwordIssueLength'),
      },
    },
  });

  const validationErrors = req.validationErrors();
  if (validationErrors) throw validationErrors;

  const issues = verifyUsername(req.body.username, res);
  if (issues.length > 0) throw new BadRequest(issues.join(' '));

  const email = req.body.email.toLowerCase();
  const username = req.body.username.trim();
  const lowerCaseUsername = username.toLowerCase();
  const { password } = req.body;

  // Check for duplicates
  const duplicate = await User.findOne({
    $or: [
      { email },
      { lowerCaseUsername },
    ],
  });

  if (duplicate) {
    if (duplicate.email === email) throw new NotAuthorized(res.t('emailTaken'));
    throw new NotAuthorized(res.t('usernameTaken'));
  }

  const hashedPassword = await passwordUtils.bcryptHash(password);

  const savedUser = await User.create({
    email,
    username,
    lowerCaseUsername,
    hashedPassword,
    passwordHashMethod: 'bcrypt',
    language: req.language || 'en',
  });

  const userJSON = savedUser.toJSON();
  userJSON.newUser = true;
  res.respond(isV3 ? 201 : 200, userJSON);

  return null;
}
