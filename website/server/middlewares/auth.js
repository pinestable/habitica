import nconf from 'nconf';
import {
  InvalidCredentialsError,
  NotAuthorized,
  BadRequest,
} from '../libs/errors';
import { model as User } from '../models/user';

const ENFORCE_CLIENT_HEADER = nconf.get('ENFORCE_CLIENT_HEADER') === 'true';

// Authenticate a request through the x-api-user and x-api-key headers.
// If options.optional is true, missing auth is allowed (req continues without a user).
export function authWithHeaders (options = {}) {
  return function authWithHeadersHandler (req, res, next) {
    const userId = req.header('x-api-user');
    const apiToken = req.header('x-api-key');
    const client = req.header('x-client');
    const optional = options.optional || false;

    if (ENFORCE_CLIENT_HEADER && !client) {
      return next(new BadRequest(res.t('missingClientHeader')));
    }

    if (!userId || !apiToken) {
      if (optional) return next();
      return next(new NotAuthorized(res.t('missingAuthHeaders')));
    }

    return User.findOne({ _id: userId })
      .then(user => {
        if (!user || apiToken !== user.apiToken) {
          throw new InvalidCredentialsError(res.t('invalidCredentials'));
        }

        res.locals.user = user;
        if (req.session) req.session.userId = user._id;
        return next();
      })
      .catch(next);
  };
}

// Authenticate via session cookie, falling back to header auth.
export function authWithSession (req, res, next) {
  const { userId } = req.session || {};

  if (!userId) {
    if (!req.header('x-api-user') || !req.header('x-api-key')) {
      return next(new NotAuthorized(res.t('invalidCredentials')));
    }
    return authWithHeaders()(req, res, next);
  }

  return User.findOne({ _id: userId })
    .then(user => {
      if (!user) throw new NotAuthorized(res.t('invalidCredentials'));
      res.locals.user = user;
      return next();
    })
    .catch(next);
}

// Kept for compatibility — chat privileges not enforced in this stripped server.
export function chatPrivilegesRequired () {
  return function chatPrivilegesRequiredHandler (_req, _res, next) {
    return next();
  };
}
