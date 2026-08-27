// TCP proxies: localhost:3000 -> host.docker.internal:3000
//               localhost:3001 -> host.docker.internal:3001
const net = require('net');

function createProxy(localPort, targetHost, targetPort) {
  const server = net.createServer((client) => {
    const upstream = net.connect(targetPort, targetHost);
    client.pipe(upstream);
    upstream.pipe(client);
    const kill = () => { try { client.destroy(); } catch {} try { upstream.destroy(); } catch {} };
    client.on('error', kill);
    upstream.on('error', kill);
    client.on('close', kill);
    upstream.on('close', kill);
  });
  server.listen(localPort, '127.0.0.1', () => {
    console.log(`[proxy] 127.0.0.1:${localPort} -> ${targetHost}:${targetPort}`);
  });
  return server;
}

createProxy(3000, 'host.docker.internal', 3000);
createProxy(3001, 'host.docker.internal', 3001);
