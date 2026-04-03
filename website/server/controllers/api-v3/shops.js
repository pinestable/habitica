import { authWithHeaders } from '../../middlewares/auth';

const api = {};

// Gamification removed — all shop endpoints return empty data

api.getMarketItems = {
  method: 'GET',
  url: '/shops/market',
  middlewares: [authWithHeaders()],
  async handler (req, res) { res.respond(200, {}); },
};

api.getMarketGear = {
  method: 'GET',
  url: '/shops/market-gear',
  middlewares: [authWithHeaders()],
  async handler (req, res) { res.respond(200, { categories: [] }); },
};

api.getQuestShopItems = {
  method: 'GET',
  url: '/shops/quests',
  middlewares: [authWithHeaders()],
  async handler (req, res) { res.respond(200, {}); },
};

api.getTimeTravelerShopItems = {
  method: 'GET',
  url: '/shops/time-travelers',
  middlewares: [authWithHeaders()],
  async handler (req, res) { res.respond(200, {}); },
};

api.getSeasonalShopItems = {
  method: 'GET',
  url: '/shops/seasonal',
  middlewares: [authWithHeaders()],
  async handler (req, res) { res.respond(200, {}); },
};

api.getBackgroundShopItems = {
  method: 'GET',
  url: '/shops/backgrounds',
  middlewares: [authWithHeaders()],
  async handler (req, res) { res.respond(200, { sets: [] }); },
};

api.getCustomizationsShop = {
  method: 'GET',
  url: '/shops/customizations',
  middlewares: [authWithHeaders()],
  async handler (req, res) { res.respond(200, {}); },
};

export default api;
