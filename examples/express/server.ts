import express from 'express';

import { env } from './env';

const app = express();

app.get('/health', (_request, response) => {
  response.json({ ok: true, env: env.NODE_ENV });
});

app.listen(env.PORT, () => {
  console.log(`Express listening on :${env.PORT}`);
});
