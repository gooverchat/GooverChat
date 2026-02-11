const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { setupSocketServer } = require('./src/lib/socket/server');

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || process.env.SERVER_PORT || 3000);
const host = process.env.HOSTNAME || '0.0.0.0';

async function start() {
  const app = next({ dev, hostname: host, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  setupSocketServer(server);

  server.listen(port, host, () => {
    console.log(`> Ready on http://${host}:${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
