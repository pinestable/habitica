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

  return next();
});

export default router;
