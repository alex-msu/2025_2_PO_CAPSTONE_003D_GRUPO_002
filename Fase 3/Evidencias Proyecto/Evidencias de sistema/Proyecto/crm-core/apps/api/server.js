import express from 'express';
const app = express();

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'api', placeholder: true });
});

app.get('/health', (_req, res) => res.send('ok'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`[api] listening on ${port}`));
