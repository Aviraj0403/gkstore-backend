import os from 'os';
import cluster from 'cluster';
import dotenv from 'dotenv';
import connectDB from './src/config/dbConfig.js';
import app from './src/app.js';

dotenv.config();

const numCPUs = os.cpus().length;
const port = process.env.PORT || 6005;

export const startCluster = () => {
  if (cluster.isMaster) {
    console.log(`\n📦 Master PID: ${process.pid}`);
    console.log(`🧠 Forking ${numCPUs} workers...\n`);
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
      console.warn(`❌ Worker ${worker.process.pid} died. Restarting...`);
      cluster.fork(); 
    });
  } else {
    connectDB()
      .then(() => {
        console.log(`✅ Worker ${process.pid} connected to MongoDB`);

        app.listen(port, () => {
          console.log(`🚀 Worker ${process.pid} running on http://localhost:${port}`);
        });
      })
      .catch((err) => {
        console.error(`🔴 Worker ${process.pid} failed to connect to MongoDB:`, err);
      });
  }
};
