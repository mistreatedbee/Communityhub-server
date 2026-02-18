import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { createApp } from './app.js';

async function bootstrap() {
  await connectDb(env.mongoUri);
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap server:', error);
  process.exit(1);
});
