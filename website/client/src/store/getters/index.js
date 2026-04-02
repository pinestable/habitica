import { flattenAndNamespace } from '@/libs/store/helpers/internals';
import * as user from './user';
import * as shops from './shops';
import * as tasks from './tasks';

const getters = flattenAndNamespace({
  user,
  tasks,
  shops,
});

export default getters;
