import 'dotenv/config';
import express from 'express';
import { getDashboardEmbedUrl } from './quicksight.js';

const app = express();
const port = process.env.PORT || 3001;

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/quicksight/dashboard-url', getDashboardEmbedUrl);

app.listen(port, () => {
  console.log(`QuickSight backend listening on http://localhost:${port}`);
});
