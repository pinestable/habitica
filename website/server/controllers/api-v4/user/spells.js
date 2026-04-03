import { authWithHeaders } from '../../../middlewares/auth';
import {
  NotAuthorized,
} from '../../../libs/errors';

const api = {};

// Gamification removed — spells/casting endpoint stubbed
api.castSpell = {
  method: 'POST',
  middlewares: [authWithHeaders()],
  url: '/user/class/cast/:spellId',
  async handler () { throw new NotAuthorized('Gamification features have been removed'); },
};

export default api;
