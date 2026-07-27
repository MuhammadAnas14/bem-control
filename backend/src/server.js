const env = require('./config/env');
const createApp = require('./app');
const { connectMqtt } = require('./mqtt/client');
const { registerMqttHandlers } = require('./mqtt/handlers');
const { startWsServer } = require('./realtime/wsServer');

function start() {
  connectMqtt();
  registerMqttHandlers();
  startWsServer();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[http] Bem Control API listening on port ${env.PORT}`);
  });
}

start();
