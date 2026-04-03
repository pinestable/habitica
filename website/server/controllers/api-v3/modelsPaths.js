const api = {};

const tasksModels = ['habit', 'daily', 'todo'];
const allModels = ['user', 'tag'].concat(tasksModels);

/**
 * @api {get} /api/v3/models/:model/paths Get all paths for the specified model
 * @apiDescription Doesn't require authentication
 * @apiName GetUserModelPaths
 * @apiGroup Meta
 *
 * @apiParam (Path) {String="user","tag","habit","daily","todo"} model The name of the model
 */
api.getModelPaths = {
  method: 'GET',
  url: '/models/:model/paths',
  async handler (req, res) {
    req.checkParams('model', res.t('modelNotFound')).notEmpty().isIn(allModels);

    const validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    // Mongoose models removed — return empty paths
    res.respond(200, {});
  },
};

export default api;
