// Social auth removed — local auth only
import { NotAuthorized } from '../errors';

export async function loginSocial () {
  throw new NotAuthorized('Social login is not available.');
}

export async function socialEmailToLocal () {
  throw new NotAuthorized('Social login is not available.');
}
