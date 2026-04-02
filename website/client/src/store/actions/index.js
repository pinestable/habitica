import { flattenAndNamespace } from '@/libs/store/helpers/internals';

import * as admin from './admin';
import * as common from './common';
import * as user from './user';
import * as tasks from './tasks';
import * as auth from './auth';
import * as notifications from './notifications';
import * as tags from './tags';
import * as shops from './shops';
import * as snackbars from './snackbars';
import * as news from './news';
import * as analytics from './analytics';
import * as faq from './faq';
import * as blockers from './blockers';

const actions = flattenAndNamespace({
  admin,
  common,
  user,
  tasks,
  auth,
  notifications,
  tags,
  shops,
  snackbars,
  news,
  analytics,
  faq,
  blockers,
});

export default actions;
