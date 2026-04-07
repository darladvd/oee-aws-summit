//for local
import 'dotenv/config';
import express from 'express';
import { getDashboardEmbedUrl, getQEmbedUrl } from './quicksight.js';

const app = express();
const port = process.env.PORT || 3001;

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/quicksight/dashboard-url', getDashboardEmbedUrl);
app.get('/api/quicksight/q-url', getQEmbedUrl);

app.listen(port, () => {
  console.log(`QuickSight backend listening on http://localhost:${port}`);
});
