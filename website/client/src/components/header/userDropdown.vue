<template>
  <menu-dropdown
    class="item-user"
    :right="true"
  >
    <div slot="dropdown-toggle">
      <div
        v-b-tooltip.hover.bottom="$t('user')"
        :aria-label="$t('user')"
      >
        <message-count
          v-if="user.inbox.newMessages > 0"
          :count="user.inbox.newMessages"
          :top="true"
        />
        <div
          class="top-menu-icon svg-icon mr-2"
          v-html="icons.user"
        ></div>
      </div>
    </div>
    <div
      slot="dropdown-content"
      class="user-dropdown"
    >
      <a
        class="topbar-dropdown-item nav-link dropdown-item
         dropdown-separated d-flex justify-content-between align-items-center"
        @click.prevent="showPrivateMessages()"
      >
        <div>{{ $t('messages') }}</div>
        <message-count
          v-if="user.inbox.newMessages > 0"
          :count="user.inbox.newMessages"
        />
      </a>
      <router-link
        class="topbar-dropdown-item dropdown-item dropdown-separated"
        :to="{name: 'general'}"
      >
        {{ $t('settings') }}
      </router-link>
      <a
        class="topbar-dropdown-item nav-link dropdown-item dropdown-separated"
        @click.prevent="logout()"
      >{{ $t('logout') }}</a>
    </div>
  </menu-dropdown>
</template>

<style lang='scss' scoped>
@import '@/assets/scss/colors.scss';
@media only screen and (max-width: 992px) {
  .item-with-icon.item-user {
    margin-right: 0px;
  }
}

.user-dropdown {
  width: 14.75em;
}

</style>

<script>
import { mapState } from '@/libs/store';
import userIcon from '@/assets/svg/user.svg?raw';
import MenuDropdown from '../ui/customMenuDropdown';
import MessageCount from './messageCount.functional.vue';
import { EVENTS } from '@/libs/events';
import { PAGES } from '@/libs/consts';

export default {
  components: {
    MenuDropdown,
    MessageCount,
  },
  data () {
    return {
      icons: Object.freeze({
        user: userIcon,
      }),
    };
  },
  computed: {
    ...mapState({ user: 'user.data' }),
  },
  methods: {
    showPrivateMessages () {
      if (this.$router.history.current.name === 'privateMessages') {
        this.$root.$emit(EVENTS.PM_REFRESH);
      } else {
        this.$router.push(PAGES.PRIVATE_MESSAGES);
      }
    },
    logout () {
      this.$store.dispatch('auth:logout');
    },
  },
};
</script>
