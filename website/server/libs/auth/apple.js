// Stub: apple-auth package removed
import { NotAuthorized } from '../errors';

// eslint-disable-next-line no-empty-function
export async function appleProfile () {
  throw new NotAuthorized('Apple Sign In is not available.');
}
