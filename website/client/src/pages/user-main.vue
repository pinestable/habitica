<template>
  <div
    id="app"
  >
    <bug-report-modal v-if="isUserLoaded" />
    <bug-report-success-modal v-if="isUserLoaded" />
    <external-link-modal />
    <delete-task-confirm-modal v-if="isUserLoaded" />
    <template v-if="isUserLoaded">
      <app-menu />
      <div
        class="container-fluid"
        :class="{'no-margin': noMargin}"
      >
        <app-header />
        <div :class="{sticky: user.preferences.stickyHeader}">
          <router-view />
        </div>
      </div>
      <app-footer v-if="!hideFooter" />
    </template>
  </div>
</template>

<style lang='scss' scoped>
  @import '@/assets/scss/colors.scss';

  #app {
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
  }

  .container-fluid {
    flex: 1 0 auto;
  }

  .no-margin {
    margin-left: 0;
    margin-right: 0;
    padding-left: 0;
    padding-right: 0;
  }

  .notification {
    border-radius: 1000px;
    background-color: $green-10;
    box-shadow: 0 2px 2px 0 rgba(26, 24, 29, 0.16), 0 1px 4px 0 rgba(26, 24, 29, 0.12);
    padding: .5em 1em;
    color: $white;
    margin-top: .5em;
    margin-bottom: .5em;
  }
</style>

<style lang='scss'>
  @import '@/assets/scss/colors.scss';

  .modal-backdrop {
    opacity: .9 !important;
    background-color: $purple-100 !important;
  }

  /* Push progress bar above modals */
  #nprogress .bar {
    z-index: 1600 !important; /* Must stay above nav bar */
  }
</style>

<script>
import axios from 'axios';

import AppMenu from '@/components/header/menu';
import AppHeader from '@/components/header/index';
import AppFooter from '@/components/appFooter';
import { mapState } from '@/libs/store';
import * as Analytics from '@/libs/analytics';
import notifications from '@/mixins/notifications';
import { startReminderNotifications } from '@/libs/reminderNotifications';
import externalLinkModal from '@/components/externalLinkModal.vue';
import deleteTaskConfirmModal from '@/components/tasks/deleteTaskConfirmModal.vue';

const bugReportModal = () => import('@/components/bugReportModal');
const bugReportSuccessModal = () => import('@/components/bugReportSuccessModal');

export default {
  name: 'App',
  components: {
    AppMenu,
    AppHeader,
    AppFooter,
    bugReportModal,
    bugReportSuccessModal,
    externalLinkModal,
    deleteTaskConfirmModal,
  },
  mixins: [notifications],
  data () {
    return {
      loading: true,
    };
  },
  computed: {
    ...mapState(['isUserLoggedIn', 'browserTimezoneUtcOffset', 'isUserLoaded']),
    ...mapState({ user: 'user.data' }),
    isStaticPage () {
      return this.$route.meta.requiresLogin === false;
    },
    noMargin () {
      return ['privateMessages'].includes(this.$route.name);
    },
    hideFooter () {
      return ['privateMessages'].includes(this.$route.name);
    },
  },
  created () {
    // Setup listener for title
    this.$store.watch(state => state.title, title => {
      document.title = title;
    });

    // Load the user and the user tasks
    Promise.all([
      this.$store.dispatch('user:fetch'),
      this.$store.dispatch('tasks:fetchUserTasks'),
    ]).then(() => {
      Analytics.updateUser();
      return this.loadAllTranslations();
    }).then(() => {
      this.$store.state.isUserLoaded = true;
      this.hideLoadingScreen();

      // Adjust the timezone offset
      const browserTimezoneOffset = -this.browserTimezoneUtcOffset;
      if (this.user.preferences.timezoneOffset !== browserTimezoneOffset) {
        this.$store.dispatch('user:set', {
          'preferences.timezoneOffset': browserTimezoneOffset,
        });
      }
    }).catch(err => {
      console.error('Impossible to fetch user. Clean up localStorage and refresh.', err); // eslint-disable-line no-console
    });
  },
  mounted () {
    // Remove the index.html loading screen and now show the inapp loading
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) document.body.removeChild(loadingScreen);

    // Start browser reminder notifications
    startReminderNotifications(() => {
      const store = this.$store;
      // Combine all task types that have reminders
      const tasks = store.state.tasks.data || {};
      return [
        ...(tasks.habits || []),
        ...(tasks.dailys || []),
        ...(tasks.todos || []),
      ];
    });
  },
  methods: {
    hideLoadingScreen () {
      this.loading = false;
    },
    async loadContentTranslations () {
      const contentTranslations = await axios.get(
        '/api/v4/i18n/content',
        {
          language: this.user.preferences.language,
        },
      );
      const i18nData = window && window['habitica-i18n'];
      i18nData.strings = { ...i18nData.strings, ...contentTranslations.data };
      this.$loadLocale(i18nData);
    },
    async loadAllTranslations () {
      if (window && window['habitica-i18n']) {
        if (this.user.preferences.language === window['habitica-i18n'].language.code) {
          return this.loadContentTranslations();
        }
      }
      await axios.get(
        '/api/v4/i18n/core',
        {
          language: this.user.preferences.language,
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
            Expires: '0',
          },
        },
      );
      return this.loadContentTranslations();
    },
  },
};
</script>
