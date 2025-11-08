import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10000,
    tls: process.env.REDIS_TLS === 'true', // enables TLS for Render/Upstash
  },
});

client.on('connect', () => console.log('✅ Connected to Redis successfully'));
client.on('error', (err) => console.error('❌ Redis Client Error:', err));

(async () => {
  try {
    console.log('Connecting to Redis...', process.env.REDIS_URL);
    await client.connect();
    console.log('🚀 Redis client connected successfully');
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', err);
  }
})();

export default client;
