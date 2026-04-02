import axios from 'axios';
import moment from 'moment';
import content from '@/../../common/script/content/index';
import * as commonConstants from '@/../../common/script/constants';
import { DAY_MAPPING } from '@/../../common/script/cron';
import deepFreeze from '@/libs/deepFreeze';
import Store from '@/libs/store';
import { asyncResourceFactory } from '@/libs/asyncResource';
import { authAsCredentialsState, LOCALSTORAGE_AUTH_KEY, setUpAxios } from '@/libs/auth';

import actions from './actions';
import getters from './getters';

const IS_TEST = import.meta.env.NODE_ENV === 'test';

let isUserLoggedIn = false;
const browserTimezoneUtcOffset = moment().utcOffset();

axios.defaults.headers.common['x-client'] = 'habitica-web';

let AUTH_SETTINGS = window.localStorage.getItem(LOCALSTORAGE_AUTH_KEY);
if (AUTH_SETTINGS) {
  AUTH_SETTINGS = JSON.parse(AUTH_SETTINGS);
  isUserLoggedIn = setUpAxios(AUTH_SETTINGS);
}

const i18nData = window && window['habitica-i18n'];

let availableLanguages = [];
let selectedLanguage = {};

if (i18nData) {
  availableLanguages = i18nData.availableLanguages;
  selectedLanguage = i18nData.language;
}

let existingStore;
export default function clientStore () {
  if (!IS_TEST && existingStore) return existingStore;

  existingStore = new Store({
    actions,
    getters,
    state: {
      serverAppVersion: null,
      title: 'Habitica',
      isUserLoggedIn,
      isUserLoaded: false,
      user: asyncResourceFactory(),
      notificationsRemoved: [],
      worldState: asyncResourceFactory(),
      credentials: isUserLoggedIn ? authAsCredentialsState(AUTH_SETTINGS) : {},
      browserTimezoneUtcOffset,
      tasks: asyncResourceFactory(),
      completedTodosStatus: 'NOT_LOADED',
      shops: {
        market: asyncResourceFactory(),
        quests: asyncResourceFactory(),
        seasonal: asyncResourceFactory(),
        'time-travelers': asyncResourceFactory(),
      },
      avatarEditorOptions: {
        editingUser: false,
        startingPage: '',
        subpage: '',
      },
      // content data, frozen to prevent Vue from modifying it
      content: deepFreeze(content),
      constants: deepFreeze({ ...commonConstants, DAY_MAPPING }),
      i18n: deepFreeze({
        availableLanguages,
        selectedLanguage,
      }),
      hideHeader: false,
      openedItemRows: [],
      spellOptions: {
        castingSpell: false,
        spellDrawOpen: true,
      },
      profileOptions: {
        startingPage: '',
      },
      giftModalOptions: {
        startingPage: '',
      },
      rageModalOptions: {
        npc: '',
      },
      profileUser: {},
      notificationStore: [],
      modalStack: [],
      equipmentDrawerOpen: true,
      isRunningYesterdailies: false,
      privateMessageOptions: {
        userIdToMessage: '',
        displayName: '',
        username: '',
        backer: {},
        contributor: {},
      },
      firstDropsOptions: {
        egg: '',
        hatchingPotion: '',
      },
      bugReportOptions: {
        question: false,
      },
      postLoadModal: '',
      registrationOptions: {},
    },
  });

  return existingStore;
}
