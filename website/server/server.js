import nconf from 'nconf';
import express from 'express';
import http from 'http';
import logger from './libs/logger';

// Setup translations
import './libs/i18n';

import attachMiddlewares from './middlewares/index';

// Setup passport (local strategy only)
import './libs/setupPassport';

import SERVER_STATUS from './libs/serverStatus';

const server = http.createServer();
const app = express();

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server'); // eslint-disable-line no-console
  server.close(() => {
    process.exit(0);
  });
});

app.set('port', nconf.get('PORT'));

attachMiddlewares(app);

server.on('request', app);
server.listen(app.get('port'), () => {
  logger.info(`Express server listening on port ${app.get('port')}`);
  SERVER_STATUS.EXPRESS = true;
});

export default server;
