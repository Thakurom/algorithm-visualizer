const http = require('http');
const { fetchLeetCodeProblem } = require('./leetcode');
const { analyzeProblem } = require('./analyze');

const PORT = 8788;

const server = http.createServer((req, res) => {
  // CORS fallback for direct calls; normal path is the CRA dev proxy (/coach -> here).
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const send = (status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/analyze') return send(404, { error: 'NOT_FOUND' });

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    let parsed;
    try {
      parsed = JSON.parse(body || '{}');
    } catch (err) {
      return send(400, { error: 'BAD_REQUEST' });
    }

    try {
      const { problem, url } = parsed || {};
      if ((problem !== undefined && typeof problem !== 'string')
        || (url !== undefined && typeof url !== 'string')) {
        return send(400, { error: 'BAD_REQUEST' });
      }
      let problemText = problem;
      if (url) {
        console.log(`[coach] fetching LeetCode problem: ${url}`);
        problemText = await fetchLeetCodeProblem(url);
      }
      if (!problemText || problemText.trim().length < 40) {
        return send(400, {
          error: 'EMPTY_PROBLEM',
          message: 'Paste the full problem statement (or a leetcode.com/problems/... URL).',
        });
      }
      console.log('[coach] analyzing with claude (this can take a minute or two)...');
      const started = Date.now();
      const result = await analyzeProblem(problemText);
      console.log(`[coach] done in ${Math.round((Date.now() - started) / 1000)}s: "${result.title}"`);
      send(200, result);
    } catch (err) {
      console.error('[coach] error:', err.message);
      send(err.status || 500, { error: err.code || 'INTERNAL', message: err.message });
    }
  });
});

server.requestTimeout = 600000; // analysis legitimately takes minutes (and may retry once)
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error('port 8788 already in use — is another coach server running?');
  } else {
    console.error(`[coach] server error: ${err.message}`);
  }
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => console.log(`Problem Coach server on http://localhost:${PORT}`));
