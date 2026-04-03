import validator from 'validator';
import moment from 'moment';
import nconf from 'nconf';
import {
  authWithHeaders,
} from '../../middlewares/auth';
import { model as User } from '../../models/user';
import common from '../../../common';
import {
  NotAuthorized,
  BadRequest,
} from '../../libs/errors';
import * as passwordUtils from '../../libs/password';
import { sendTxn as sendTxnEmail } from '../../libs/email';
import { encrypt } from '../../libs/encryption';
import {
  loginRes,
  registerLocal,
} from '../../libs/auth';
import { verifyUsername } from '../../libs/user/validation';

const BASE_URL = nconf.get('BASE_URL');
const TECH_ASSISTANCE_EMAIL = nconf.get('EMAILS_TECH_ASSISTANCE_EMAIL');

const api = {};

/**
 * @api {post} /api/v3/user/auth/local/register Register
 */
api.registerLocal = {
  method: 'POST',
  middlewares: [authWithHeaders({ optional: true })],
  url: '/user/auth/local/register',
  async handler (req, res) {
    await registerLocal(req, res, { isV3: true });
  },
};

/**
 * @api {post} /api/v3/user/auth/local/login Login
 */
api.loginLocal = {
  method: 'POST',
  url: '/user/auth/local/login',
  middlewares: [],
  async handler (req, res) {
    req.checkBody({
      username: { notEmpty: true, errorMessage: res.t('missingUsernameEmail') },
      password: { notEmpty: true, errorMessage: res.t('missingPassword') },
    });
    const validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    req.sanitizeBody('username').trim();
    req.sanitizeBody('password').trim();

    const { username, password } = req.body;

    // Find by email or username
    const where = validator.isEmail(String(username))
      ? { email: username.toLowerCase() }
      : { username };

    const user = await User.findOne(where);
    if (!user || !user.hashedPassword) throw new NotAuthorized(res.t('invalidLoginCredentialsLong'));

    const isValid = await passwordUtils.compare(user, password);
    if (!isValid) throw new NotAuthorized(res.t('invalidLoginCredentialsLong'));

    await user.save(); // updates updatedAt via Prisma @updatedAt

    return loginRes(user, req, res);
  },
};

/**
 * @api {put} /api/v3/user/auth/update-username Update username
 */
api.updateUsername = {
  method: 'PUT',
  middlewares: [authWithHeaders()],
  url: '/user/auth/update-username',
  async handler (req, res) {
    const { user } = res.locals;

    req.checkBody({ username: { notEmpty: { errorMessage: res.t('missingUsername') } } });
    const validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    const newUsername = req.body.username;
    const issues = verifyUsername(newUsername, res, false);
    if (issues.length > 0) throw new BadRequest(issues.join(' '));

    const existingUser = await User.findOne({ lowerCaseUsername: newUsername.toLowerCase() });
    if (existingUser && existingUser._id !== user._id) {
      throw new BadRequest(res.t('usernameTaken'));
    }

    user.lowerCaseUsername = newUsername.toLowerCase();
    user.username = newUsername;
    await user.save();

    res.respond(200, { username: newUsername });
  },
};

/**
 * @api {put} /api/v3/user/auth/update-password Update password
 */
api.updatePassword = {
  method: 'PUT',
  middlewares: [authWithHeaders()],
  url: '/user/auth/update-password',
  async handler (req, res) {
    const { user } = res.locals;

    if (!user.hashedPassword) throw new BadRequest(res.t('userHasNoLocalRegistration'));

    req.checkBody({
      password: { notEmpty: { errorMessage: res.t('missingPassword') } },
      newPassword: {
        notEmpty: { errorMessage: res.t('missingNewPassword') },
        isLength: {
          options: {
            min: common.constants.MINIMUM_PASSWORD_LENGTH,
            max: common.constants.MAXIMUM_PASSWORD_LENGTH,
          },
          errorMessage: res.t('passwordIssueLength'),
        },
      },
      confirmPassword: { notEmpty: { errorMessage: res.t('missingNewPassword') } },
    });

    const validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    const isValid = await passwordUtils.compare(user, req.body.password);
    if (!isValid) throw new NotAuthorized(res.t('wrongPassword'));

    if (req.body.newPassword !== req.body.confirmPassword) {
      throw new NotAuthorized(res.t('passwordConfirmationMatch'));
    }

    await passwordUtils.convertToBcrypt(user, req.body.newPassword);
    user.apiToken = common.uuid();
    await user.save();

    res.respond(200, { apiToken: user.apiToken });
  },
};

/**
 * @api {post} /api/v3/user/reset-password Request a password reset email
 */
api.resetPassword = {
  method: 'POST',
  middlewares: [],
  url: '/user/reset-password',
  async handler (req, res) {
    req.checkBody({ email: { notEmpty: { errorMessage: res.t('missingEmail') } } });
    const validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    const email = req.body.email.toLowerCase();
    const user = await User.findOne({ email });

    if (user) {
      const passwordResetCode = encrypt(JSON.stringify({
        userId: user._id,
        expiresAt: moment().add({ hours: 24 }),
      }));
      const link = `${BASE_URL}/static/user/auth/local/reset-password-set-new-one?code=${passwordResetCode}`;

      user.passwordResetCode = passwordResetCode;

      sendTxnEmail(user, 'reset-password', [
        { name: 'PASSWORD_RESET_LINK', content: link },
      ]);

      await user.save();
    }

    res.respond(200, {}, res.t('passwordReset'));
  },
};

/**
 * @api {put} /api/v3/user/auth/update-email Update email
 */
api.updateEmail = {
  method: 'PUT',
  middlewares: [authWithHeaders()],
  url: '/user/auth/update-email',
  async handler (req, res) {
    const { user } = res.locals;

    if (!user.email) throw new BadRequest(res.t('userHasNoLocalRegistration'));

    req.checkBody('newEmail', res.t('newEmailRequired')).notEmpty().isEmail();
    if (user.hashedPassword) {
      req.checkBody('password', res.t('missingPassword')).notEmpty();
    }
    const validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    const newEmail = req.body.newEmail.toLowerCase();

    const emailInUse = await User.findOne({ email: newEmail });
    if (emailInUse) {
      throw new NotAuthorized(res.t('cannotFulfillReq', { techAssistanceEmail: TECH_ASSISTANCE_EMAIL }));
    }

    if (user.hashedPassword) {
      const isValid = await passwordUtils.compare(user, req.body.password);
      if (!isValid) throw new NotAuthorized(res.t('wrongPassword'));
    }

    user.email = newEmail;
    user.passwordResetCode = undefined;
    await user.save();

    return res.respond(200, { email: user.email });
  },
};

/**
 * @api {post} /api/v3/user/auth/reset-password-set-new-one Complete a password reset
 */
api.resetPasswordSetNewOne = {
  method: 'POST',
  url: '/user/auth/reset-password-set-new-one',
  async handler (req, res) {
    const user = await passwordUtils.validatePasswordResetCodeAndFindUser(req.body.code);
    if (!user) throw new NotAuthorized(res.t('invalidPasswordResetCode'));

    req.checkBody({
      newPassword: {
        notEmpty: { errorMessage: res.t('missingNewPassword') },
        isLength: {
          options: { min: common.constants.MINIMUM_PASSWORD_LENGTH },
          errorMessage: res.t('minPasswordLength'),
        },
      },
      confirmPassword: { notEmpty: { errorMessage: res.t('missingNewPassword') } },
    });

    const validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    const { newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) throw new BadRequest(res.t('passwordConfirmationMatch'));

    await passwordUtils.convertToBcrypt(user, String(newPassword));
    user.passwordResetCode = undefined;
    await user.save();

    res.respond(200, {}, res.t('passwordChangeSuccess'));
  },
};

export default api;
