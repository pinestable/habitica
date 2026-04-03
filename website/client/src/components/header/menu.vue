<template>
  <div>
    <profileModal />
    <report-member-modal />
    <b-navbar
      id="habitica-menu"
      class="topbar navbar-inverse static-top"
      toggleable="lg"
      type="dark"
    >
      <b-navbar-brand
        class="brand"
        aria-label="Habitica"
      >
        <router-link to="/">
          <div
            class="logo svg-icon svg color gryphon pl-2 mr-3"
            v-html="icons.melior"
          ></div>
          <div class="svg-icon"></div>
        </router-link>
        <div class="svg-icon"></div>
      </b-navbar-brand>
      <b-navbar-toggle
        class="menu-toggle"
        target="menu_collapse"
      />
      <div class="quick-menu mobile-only form-inline">
        <a
          v-b-tooltip.hover.bottom="$t('sync')"
          class="item-with-icon"
          :aria-label="$t('sync')"
          @click="sync"
        >
          <div
            class="top-menu-icon svg-icon"
            v-html="icons.sync"
          ></div>
        </a>
        <notification-menu class="item-with-icon" />
        <user-dropdown class="item-with-icon" />
      </div>
      <b-collapse
        id="menu_collapse"
        v-model="menuIsOpen"
        class="collapse navbar-collapse"
      >
        <b-navbar-nav class="menu-list">
          <b-nav-item
            class="topbar-item"
            :class="{'active': $route.path === '/'}"
            tag="li"
            :to="{name: 'tasks'}"
            exact="exact"
          >
            {{ $t('tasks') }}
          </b-nav-item>
          <li
            class="topbar-item droppable"
            :class="{
              'active': $route.path.startsWith('/help')}"
          >
            <div
              class="chevron rotate"
              @click="dropdownMobile($event)"
            >
              <div
                v-once
                class="chevron-icon-down"
                v-html="icons.chevronDown"
              ></div>
            </div>
            <router-link
              class="nav-link"
              :to="{name: 'faq'}"
            >
              {{ $t('help') }}
            </router-link>
            <div class="topbar-dropdown">
              <router-link
                class="topbar-dropdown-item dropdown-item"
                :to="{name: 'faq'}"
              >
                {{ $t('faq') }}
              </router-link>
              <router-link
                class="topbar-dropdown-item dropdown-item"
                :to="{name: 'overview'}"
              >
                {{ $t('overview') }}
              </router-link>
              <a
                class="topbar-dropdown-item dropdown-item"
                target="_blank"
                @click.prevent="openBugReportModal()"
              >
                {{ $t('reportBug') }}
              </a>
              <a
                class="topbar-dropdown-item dropdown-item"
                target="_blank"
                @click.prevent="openBugReportModal(true)"
              >
                {{ $t('askQuestion') }}
              </a>
              <a
                class="topbar-dropdown-item dropdown-item"
                href="https://docs.google.com/forms/d/e/1FAIpQLScPhrwq_7P1C6PTrI3lbvTsvqGyTNnGzp1ugi1Ml0PFee_p5g/viewform?usp=sf_link"
                target="_blank"
              >{{ $t('requestFeature') }}</a>
            </div>
          </li>
          <li
            v-if="hasElevatedPrivileges"
            class="topbar-item droppable"
            :class="{
              'active': $route.path.startsWith('/admin')}"
          >
            <div
              class="chevron rotate"
              @click="dropdownMobile($event)"
            >
              <div
                v-once
                class="chevron-icon-down"
                v-html="icons.chevronDown"
              ></div>
            </div>
            <router-link
              v-if="hasPermission(user, 'userSupport')"
              class="nav-link"
              :to="{name: 'adminPanel'}"
            >
              {{ $t('admin') }}
            </router-link>
            <a
              v-else
              href="#"
              class="nav-link"
            >
              {{ $t('admin') }}
            </a>
            <div class="topbar-dropdown">
              <router-link
                v-if="hasPermission(user, 'userSupport')"
                class="topbar-dropdown-item dropdown-item"
                :to="{name: 'adminPanel'}"
              >
                {{ $t("adminPanel") }}
              </router-link>
              <router-link
                v-if="hasPermission(user, 'accessControl')"
                class="topbar-dropdown-item dropdown-item"
                :to="{name: 'blockers'}"
              >
                {{ $t("siteBlockers") }}
              </router-link>
              <a
                v-if="hasPermission(user, 'news')"
                class="topbar-dropdown-item dropdown-item"
                target="_blank"
                href="https://panel.habitica.com"
              >
                {{ $t('newsroom') }}
              </a>
            </div>
          </li>
        </b-navbar-nav>
        <div class="form-inline desktop-only">
          <a
            v-b-tooltip.hover.bottom="$t('sync')"
            class="item-with-icon"
            role="link"
            :aria-label="$t('sync')"
            tabindex="0"
            @click="sync"
            @keyup.enter="sync"
          >
            <div
              class="top-menu-icon svg-icon"
              v-html="icons.sync"
            ></div>
          </a>
          <notification-menu class="item-with-icon" />
          <user-dropdown class="item-with-icon" />
        </div>
      </b-collapse>
    </b-navbar>
  </div>
</template>

<style lang="scss">
body.modal-open #habitica-menu {
  z-index: 1035;
}
</style>

<style lang="scss" scoped>
  @import '@/assets/scss/colors.scss';
  @import '@/assets/scss/utils.scss';
  @import '@/assets/scss/variables.scss';

  .menu-toggle {
    border: none;
  }

  #menu_collapse {
    display: flex;
    justify-content: space-between;
  }

  .topbar {
    z-index: 1080;
    background: $purple-100 url(@/assets/svg/for-css/bits.svg) right top no-repeat;
    min-height: 56px;
    box-shadow: 0 1px 2px 0 rgba($black, 0.24);

    a {
      color: white !important;
    }
  }

  .logo {
    color: $white;
    height: 32px;
    object-fit: contain;
    width: 32px;
  }

  .quick-menu {
    display: flex;
    margin-left: auto;
  }


  .topbar-item {
    font-size: 16px;
    color: $white !important;
    font-weight: bold;
    transition: none;

    .topbar-dropdown  {
        overflow: hidden;
        max-height: 0;

        .topbar-dropdown-item {
          line-height: 1.5;
          font-size: 16px;
        }
    }

    >a {
      padding: .8em 1em !important;
    }

    &.down {
      color: $white !important;
      background: $purple-200;

      .topbar-dropdown {
        margin-top: 0; // Remove gap between navbar and drop-down.
        background: $purple-200;
        border-radius: 0px;
        border: none;
        box-shadow: none;
        padding: 0px;

        border-bottom-right-radius: 5px;
        border-bottom-left-radius: 5px;

        .topbar-dropdown-item {
          font-size: 16px;
          box-shadow: none;
          color: $white;
          border: none;
          line-height: 1.5;
          display: list-item;

          &.active {
            background: $purple-300;
          }

          &:hover {
            background: $purple-300;
            text-decoration: none;

            &:last-child {
              border-bottom-right-radius: 5px;
              border-bottom-left-radius: 5px;
            }
          }
        }
      }
    }
  }

  .dropdown + .dropdown {
    margin-left: 0px;
  }

  .item-with-icon {
    color: $white;
    font-size: 16px;
    font-weight: normal;
    white-space: nowrap;

    span {
      font-weight: bold;
    }

    &:focus ::v-deep .top-menu-icon.svg-icon,
    &:hover ::v-deep .top-menu-icon.svg-icon {
      color: $white;
    }

    & ::v-deep .top-menu-icon.svg-icon {
      color: $header-color;
      vertical-align: bottom;
      display: inline-block;
      width: 24px;
      height: 24px;
      margin-right: 12px;
      margin-left: 12px;
    }
  }

  a.item-with-icon:focus {
    outline: none;
  }

  .message-count.top-count {
    background-color: $red-50;
    position: absolute;
    right: 0;
    top: -0.5em;
    padding: .2em;
  }
  @media only screen and (max-width: 1200px) {
    .chevron {
      display: none
    }

    .gryphon {
      background-size: cover;
      color: $white;
      height: 32px;
      margin: 0 auto;
      top: -10px;
      padding-left: 8px;
      position: relative;
      width: 32px;
    }

    .logo {
      padding-top: 12px;
      color: $white;
    }

    .topbar-item {
      font-size: 14px !important;
    }
  }

  @media only screen and (min-width: 992px) {
    .chevron {
      display: none
    }

    .mobile-only {
      display: none !important;
    }

    .topbar {
      max-height: $menuToolbarHeight;

      .topbar-item {
        padding-top: 5px;
        height: 56px;

        &:hover {
          background: $purple-200;
        }

        &.active:not(:hover) {
          box-shadow: 0px -4px 0px $purple-300 inset;
        }
      }

      .topbar-dropdown {
        position: absolute;
      }
    }
  }

  @media only screen and (max-width: 992px) {
    .brand {
      margin: 0;
    }

    .gryphon {
      position: absolute;
      left: calc(50% - 30px);
      top: -2px;
    }

    #menu_collapse {
      margin: 0.6em -16px -8px;
      overflow: auto;
      flex-direction: column;
      background-color: $purple-100;

      .menu-list {
        width: 100%;
        order: 1;
        text-align: center;

        .topbar-dropdown  {
          transition: max-height 0.25s ease;
        }

        .topbar-dropdown-item {
          background: #432874;
          border-bottom: #6133b4 solid 1px;
        }

        .chevron {
          width: 20%;
          height: 42px;
          position: absolute;
          right: 0;
          top: 0;
          display: block;
        }

        .chevron-icon-down {
          width: 14px;
          top: 11px;
          right: 12px;
          position: absolute;
          display: block;
          transition: transform 0.25s ease;
        }

        .down .rotate .chevron-icon-down {
          transform: rotate(-180deg);
          }

        .topbar-item {
          position: relative;

          &.active {
            background: #6133b4;
          }

          background: #4f2a93;
          border-bottom: #6133b4 solid 1px;
        }
      }
    }

    .desktop-only {
      display: none !important;
    }

    .navbar-toggler {
      padding-left: 8px;
      padding-right: 8px;
    }

    .item-with-icon {
      margin-left: 0px;
      margin-right: 16px;

      & ::v-deep .top-menu-icon.svg-icon {
        margin-right: 0px;
        margin-left: 0px;
      }
    }
  }

</style>

<script>
import { mapState } from '@/libs/store';
import { goToModForm } from '@/libs/modform';

import syncIcon from '@/assets/svg/sync.svg?raw';
import chevronDownIcon from '@/assets/svg/chevron-down.svg?raw';
import melior from '@/assets/svg/melior.svg?raw';

import notificationMenu from './notificationsDropdown';
import profileModal from '../userMenu/profileModal';
import reportMemberModal from '../members/reportMemberModal';
import sync from '@/mixins/sync';
import userDropdown from './userDropdown';
import reportBug from '@/mixins/reportBug.js';
import { userStateMixin } from '../../mixins/userState';

export default {
  components: {
    notificationMenu,
    profileModal,
    reportMemberModal,
    userDropdown,
  },
  mixins: [sync, reportBug, userStateMixin],
  data () {
    return {
      isUserDropdownOpen: false,
      menuIsOpen: false,
      partyLeaderId: null,
      icons: Object.freeze({
        sync: syncIcon,
        melior,
        chevronDown: chevronDownIcon,
      }),
    };
  },
  computed: {
    ...mapState({
      user: 'user.data',
      modalStack: 'modalStack',
    }),
    hasElevatedPrivileges () {
      return this.user.permissions.fullAccess
        || this.user.permissions.userSupport
        || this.user.permissions.accessControl
        || this.user.permissions.news;
    },
  },
  async mounted () {
    if (document.getElementById('menu_collapse')) {
      Array.from(document.getElementById('menu_collapse').getElementsByTagName('a')).forEach(link => {
        link.addEventListener('click', this.closeMenu);
      });
    }
    Array.from(document.getElementsByClassName('topbar-item')).forEach(link => {
      link.addEventListener('mouseenter', this.dropdownDesktop);
      link.addEventListener('mouseleave', this.dropdownDesktop);
    });
  },
  methods: {
    modForm () {
      goToModForm(this.user);
    },
    toggleUserDropdown () {
      this.isUserDropdownOpen = !this.isUserDropdownOpen;
    },
    dropdownDesktop (hover) {
      if (this.isDesktop() && hover.target.classList.contains('droppable')) {
        if (hover.type === 'mouseenter') {
          this.openDropdown(hover.target);
        } else {
          this.closeDropdown(hover.target);
        }
      }
    },
    dropdownMobile (click) {
      const element = click.currentTarget.parentElement;
      const droppedElement = document.getElementsByClassName('down')[0];
      if (droppedElement && droppedElement !== element) {
        droppedElement.classList.remove('down');
        if (droppedElement.lastChild) {
          droppedElement.lastChild.style.maxHeight = 0;
        }
      }
      if (element.classList.contains('down')) {
        this.closeDropdown(element);
      } else {
        this.openDropdown(element);
      }
    },
    closeDropdown (element) {
      element.classList.remove('down');
      element.lastChild.style.maxHeight = 0;
    },
    openDropdown (element) {
      element.classList.add('down');
      element.lastChild.style.maxHeight = `${element.lastChild.scrollHeight}px`;
    },
    closeMenu () {
      Array.from(document.getElementsByClassName('droppable')).forEach(droppableElement => {
        this.closeDropdown(droppableElement);
      });
      if (this.isMobile()) {
        this.menuIsOpen = false;
      }
    },
    isMobile () {
      return document.documentElement.clientWidth < 992;
    },
    isDesktop () {
      return !this.isMobile();
    },
  },
};
</script>
