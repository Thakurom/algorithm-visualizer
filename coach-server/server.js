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
    try {
      const { problem, url } = JSON.parse(body || '{}');
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
server.listen(PORT, () => console.log(`Problem Coach server on http://localhost:${PORT}`));
