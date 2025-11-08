import cron from 'node-cron';
import { monitorRedisAndClearCacheIfNeeded } from '../controllers/redis.controller.js';
import checkAndClearIndex from '../elasticSearch/clearIndex.js';
import {createFoodIndex} from '../elasticSearch/createFoodIndex.js';

// Define the cron jobs
export function startCronJobs() {

  // Every 5 days at midnight, run Redis monitor job
  cron.schedule('0 0 */5 * *', () => {
    console.log('Running Redis monitor job...');
    monitorRedisAndClearCacheIfNeeded();
  });

  // Every 5 days at midnight, run Elasticsearch index check and clear job
  // cron.schedule('0 0 */5 * *', () => {  
  //   console.log('Running Elasticsearch index size check and clearing...');
  //   checkAndClearIndex();  // Calls the function to check and clear Elasticsearch index
  // });

  // // On the 1st of every month at midnight, recreate the Elasticsearch index
  // cron.schedule('0 0 * * *', () => {  // Corrected to run on the 1st of every month
  //   console.log('Running Elasticsearch index recreation job...');
  //   createFoodIndex();  // Calls the function to recreate the Elasticsearch index
  // });

  // console.log('Cron jobs started');
}
