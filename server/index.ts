import express from 'express';
import { getDb } from './db.js';
import healthRouter from './routes/health.js';
import casesRouter from './routes/cases.js';
import appStateRouter from './routes/appState.js';
import csvRouter from './routes/csv.js';

const app = express();
const API_PORT = parseInt(process.env.API_PORT || '3021', 10);

app.use(express.json({ limit: '5mb' }));

app.use(healthRouter);
app.use(casesRouter);
app.use(appStateRouter);
app.use(csvRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

getDb();
console.log('[server] Database initialized');

app.listen(API_PORT, () => {
  console.log(`[server] API server listening on port ${API_PORT}`);
});
