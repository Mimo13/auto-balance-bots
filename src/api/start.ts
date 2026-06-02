import { startApi } from './server.js';

const PORT = Number(process.env.API_PORT ?? 3141);

const server = await startApi(PORT);
const addr = server.address();
console.log(`API server listening on port ${typeof addr === 'object' && addr ? addr.port : PORT}`);
