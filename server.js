// Local preview server only. In production the site is fully static:
// GitHub Actions runs scripts/dream.js on a schedule and commits public/data,
// and Vercel serves the public/ folder.

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`SISYPHUS PROJECT preview on http://localhost:${PORT}`);
  console.log('to file an entry locally: npm run dream');
});
