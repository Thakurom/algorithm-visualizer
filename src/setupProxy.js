const { createProxyMiddleware } = require('http-proxy-middleware');

// CRA loads this into webpack-dev-server automatically.
// /api   -> the production Algorithm Visualizer API (algorithm catalog + JS tracer worker),
//           so no local backend is needed for development.
// /coach -> the local Problem Coach companion server (coach-server/), which can take
//           minutes per request because it runs the Claude CLI.
module.exports = function (app) {
  app.use('/api', createProxyMiddleware({
    target: 'https://algorithm-visualizer.org',
    changeOrigin: true,
    secure: true,
  }));
  app.use('/coach', createProxyMiddleware({
    target: 'http://localhost:8788',
    changeOrigin: true,
    pathRewrite: { '^/coach': '' },
    proxyTimeout: 300000,
    timeout: 300000,
  }));
};
