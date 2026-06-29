import { loadConfig } from './config/env';
import { buildContainer } from './container';
import { buildApp } from './app';

/* istanbul ignore file -- process bootstrap, exercised outside tests */

const config = loadConfig(process.env);
const container = buildContainer(config);
const app = buildApp({ services: container.services, token: container.token });

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${config.port}`);
});

const shutdown = (): void => {
  server.close(() => {
    void container.close();
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
