import { authWithHeaders } from '../../../middlewares/auth';
import {
  NotAuthorized,
} from '../../../libs/errors';

const api = {};

// Gamification removed — stat allocation endpoints stubbed

api.allocate = {
  method: 'POST',
  middlewares: [authWithHeaders()],
  url: '/user/allocate',
  async handler () { throw new NotAuthorized('Gamification features have been removed'); },
};

api.allocateBulk = {
  method: 'POST',
  middlewares: [authWithHeaders()],
  url: '/user/allocate-bulk',
  async handler () { throw new NotAuthorized('Gamification features have been removed'); },
};

api.allocateNow = {
  method: 'POST',
  middlewares: [authWithHeaders()],
  url: '/user/allocate-now',
  async handler () { throw new NotAuthorized('Gamification features have been removed'); },
};

export default api;
