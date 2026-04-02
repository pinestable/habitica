import Vue from 'vue';
import VueRouter from 'vue-router';
import getStore from '@/store';
import handleRedirect from './handleRedirect';

import { PAGES } from '@/libs/consts';
import { STATIC_ROUTES } from './static-routes';
import { USER_ROUTES } from './user-routes';

// NOTE: when adding a page make sure to implement the `common:setTitle` action

const Logout = () => import(/* webpackChunkName: "auth" */'@/components/auth/logout');

// Admin Pages
const AdminContainerPage = () => import(/* webpackChunkName: "admin-panel" */'@/components/admin/container');
const AdminPanelPage = () => import(/* webpackChunkName: "admin-panel" */'@/components/admin/admin-panel');
const AdminPanelUserPage = () => import(/* webpackChunkName: "admin-panel" */'@/components/admin/admin-panel/user-support');
const AdminPanelSearchPage = () => import(/* webpackChunkName: "admin-panel" */'@/components/admin/admin-panel/search');

// Tasks
const UserTasks = () => import(/* webpackChunkName: "userTasks" */'@/components/tasks/user');

// Inventory
const InventoryContainer = () => import(/* webpackChunkName: "inventory" */'@/components/inventory/index');
const ItemsPage = () => import(/* webpackChunkName: "inventory" */'@/components/inventory/items/index');
const EquipmentPage = () => import(/* webpackChunkName: "inventory" */'@/components/inventory/equipment/index');
const StablePage = () => import(/* webpackChunkName: "inventory" */'@/components/inventory/stable/index');

// Shops
const ShopsContainer = () => import(/* webpackChunkName: "shops" */'@/components/shops/index');
const MarketPage = () => import(/* webpackChunkName: "shops-market" */'@/components/shops/market/index');
const QuestsPage = () => import(/* webpackChunkName: "shops-quest" */'@/components/shops/quests/index');
const CustomizationsPage = () => import(/* webpackChunkName: "shops-customizations" */'@/components/shops/customizations/index');
const SeasonalPage = () => import(/* webpackChunkName: "shops-seasonal" */'@/components/shops/seasonal/index');
const TimeTravelersPage = () => import(/* webpackChunkName: "shops-timetravelers" */'@/components/shops/timeTravelers/index');

const MessagesIndex = () => import(/* webpackChunkName: "private-messages" */ '@/pages/private-messages/index.vue');

Vue.use(VueRouter);

const router = new VueRouter({
  mode: 'history',
  base: '/',
  linkActiveClass: 'active',
  scrollBehavior () {
    return { x: 0, y: 0 };
  },
  routes: [
    { name: 'logout', path: '/logout', component: Logout },
    { name: 'tasks', path: '/', component: UserTasks },
    {
      name: 'userProfile',
      path: '/profile/:userId',
      props: true,
    },
    { name: 'profile', path: '/user/profile' },
    {
      name: 'avatar',
      path: '/avatar',
      children: [
        { name: 'backgrounds', path: 'backgrounds' },
      ],
    },
    { name: 'stats', path: '/user/stats' },
    { name: 'achievements', path: '/user/achievements' },
    {
      path: '/inventory',
      component: InventoryContainer,
      children: [
        { name: 'items', path: 'items', component: ItemsPage },
        { name: 'equipment', path: 'equipment', component: EquipmentPage },
        { name: 'stable', path: 'stable', component: StablePage },
      ],
    },
    {
      path: '/shops',
      component: ShopsContainer,
      children: [
        { name: 'market', path: 'market', component: MarketPage },
        { name: 'quests', path: 'quests', component: QuestsPage },
        { name: 'customizations', path: 'customizations', component: CustomizationsPage },
        { name: 'seasonal', path: 'seasonal', component: SeasonalPage },
        { name: 'time', path: 'time', component: TimeTravelersPage },
      ],
    },
    USER_ROUTES,
    STATIC_ROUTES,
    { path: PAGES.PRIVATE_MESSAGES, name: 'privateMessages', component: MessagesIndex },

    {
      name: 'adminSection',
      path: '/admin',
      component: AdminContainerPage,
      meta: {
        privilegeNeeded: [
          'userSupport',
          'accessControl',
        ],
      },
      children: [
        {
          name: 'adminPanel',
          path: 'panel',
          component: AdminPanelPage,
          meta: {
            privilegeNeeded: [
              'userSupport',
            ],
          },
          children: [
            {
              name: 'adminPanelSearch',
              path: 'search/:userIdentifier',
              component: AdminPanelSearchPage,
              meta: {
                privilegeNeeded: [
                  'userSupport',
                ],
              },
            },
            {
              name: 'adminPanelUser',
              path: ':userIdentifier',
              component: AdminPanelUserPage,
              meta: {
                privilegeNeeded: [
                  'userSupport',
                ],
              },
            },
          ],
        },
      ],
    },

    { path: '/redirect/:redirect', name: 'redirect' },
    { path: '*', redirect: { name: 'notFound' } },
  ],
});

const store = getStore();

router.beforeEach(async (to, from, next) => {
  const { isUserLoggedIn, isUserLoaded } = store.state;
  const routeRequiresLogin = to.meta.requiresLogin !== false;
  const routePrivilegeNeeded = to.meta.privilegeNeeded;

  if (to.name === 'redirect') return handleRedirect(to, from, next);

  if (!isUserLoggedIn && routeRequiresLogin) {
    const redirectTo = to.path === '/' ? 'home' : 'login';
    return next({
      name: redirectTo,
      query: redirectTo === 'login' ? {
        redirectTo: to.path,
      } : to.query,
    });
  }

  if (to.name === 'register' && !to.query.redirectTo && from.name === 'login' && from.query.redirectTo) {
    return next({
      name: 'register',
      query: {
        redirectTo: from.query.redirectTo,
      },
    });
  }

  if (isUserLoggedIn && (to.name === 'login' || to.name === 'register')) {
    return next({ name: 'tasks' });
  }

  if (routePrivilegeNeeded) {
    if (!isUserLoaded) await store.dispatch('user:fetch');
    if (!store.state.user.data.permissions.fullAccess) {
      const userHasPriv = routePrivilegeNeeded.some(
        privName => store.state.user.data.permissions[privName],
      );
      if (!userHasPriv) return next({ name: 'tasks' });
    }
  }

  if ((to.name === 'userProfile')) {
    let startingPage = 'profile';
    if (to.params.startingPage !== undefined) {
      startingPage = to.params.startingPage;
    }
    if (to.hash === '#stats' || to.hash === '#achievements') {
      startingPage = to.hash.substring(1);
    }
    if (from.name === null) {
      store.state.postLoadModal = `profile/${to.params.userId}`;
      return next({ name: 'tasks' });
    }
    router.app.$emit('habitica:show-profile', {
      userId: to.params.userId,
      startingPage,
      fromPath: from.path,
      toPath: to.path,
    });

    return null;
  }

  if (to.name === 'tasks' && to.query.openGemsModal === 'true') {
    store.state.postLoadModal = 'buy-gems';
    return next({ name: 'tasks' });
  }

  if ((to.name === 'stats' || to.name === 'achievements' || to.name === 'profile') && from.name !== null) {
    const userId = store.state.user.data._id;
    let redirectPath = `/profile/${userId}`;
    if (to.name === 'stats') {
      redirectPath += '#stats';
    } else if (to.name === 'achievements') {
      redirectPath += '#achievements';
    }
    router.app.$emit('habitica:show-profile', {
      userId,
      startingPage: to.name,
      fromPath: from.path,
      toPath: redirectPath,
    });
    return null;
  }

  if (from.name === 'userProfile' || from.name === 'stats' || from.name === 'achievements' || from.name === 'profile') {
    router.app.$root.$emit('bv::hide::modal', 'profile');
  }

  if (to.name === 'backgrounds') {
    store.state.avatarEditorOptions.editingUser = true;
    store.state.avatarEditorOptions.startingPage = 'backgrounds';
    router.app.$root.$emit('bv::show::modal', 'avatar-modal');
    return null;
  }

  return next();
});

export default router;
