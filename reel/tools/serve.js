// Minimal static file server for the render pages (models are fetched, and Chromium blocks fetch() on file://).
// serve(root) -> Promise<{ url(absPath), close() }>, bound to 127.0.0.1 on a free port.
const http = require('http'), fs = require('fs'), path = require('path');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.fbx': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };

module.exports = function serve(root) {
  root = path.resolve(root);
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({
    url: abs => `http://127.0.0.1:${server.address().port}/` + path.relative(root, path.resolve(abs)).split(path.sep).map(encodeURIComponent).join('/'),
    close: () => server.close(),
  })));
};
