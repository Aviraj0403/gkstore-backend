import { clearAllRedisCache } from '../services/redis.service.js';
import client from '../config/redisClient.js';
import axios from 'axios';

export const clearCacheHandler = async (req, res) => {
  const result = await clearAllRedisCache();

  if (result.success) {
    return res.status(200).json({ success: true, message: result.message, deletedCount: result.deletedCount });
  } else {
    return res.status(500).json({ success: false, message: result.message });
  }
};

const parseRedisInfo = (infoString) => {
  const lines = infoString.split('\r\n');
  const metrics = {};
  let totalKeys = 0;

  lines.forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split(':');
      if (key && value) {
        metrics[key] = value;
        if (key.startsWith('db')) {
          const keysMatch = value.match(/keys=(\d+)/);
          if (keysMatch) {
            totalKeys += parseInt(keysMatch[1], 10);
          }
        }
      }
    }
  });

  return {
    usedMemoryMB: (parseInt(metrics.used_memory) / (1024 * 1024)).toFixed(2),
    totalMemoryMB: metrics.maxmemory === '0'
      ? (parseInt(metrics.total_system_memory) / (1024 * 1024)).toFixed(2)
      : (parseInt(metrics.maxmemory) / (1024 * 1024)).toFixed(2),
    totalKeys: totalKeys.toString(),
    hits: parseInt(metrics.keyspace_hits || '0'),
    misses: parseInt(metrics.keyspace_misses || '0'),
    evictedKeys: parseInt(metrics.evicted_keys || '0'),
  };
};

export const getRedisStats = async (req, res) => {
  try {
    const infoString = await client.info();
    const stats = parseRedisInfo(infoString);

    const totalLookups = stats.hits + stats.misses;
    const hitRatio = totalLookups > 0 ? (stats.hits / totalLookups) * 100 : 0;

    return res.json({
      success: true,
      data: {
        memoryUsageMB: stats.usedMemoryMB,
        maxMemoryMB: stats.totalMemoryMB,
        totalKeys: stats.totalKeys,
        cacheHits: stats.hits,
        cacheMisses: stats.misses,
        evictedKeys: stats.evictedKeys,
        cacheHitRatioPercent: hitRatio.toFixed(2),
      },
    });
  } catch (error) {
    console.error('Error fetching Redis stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Redis stats',
    });
  }
};


/*---------------------------------------------------------------------------------*/
const REDIS_STATS_URL = 'https://api.the9to9restaurant.com/v1/api/redis/stats';
const CLEAR_REDIS_URL = 'https://api.the9to9restaurant.com/v1/api/redis/clear-redis';

const THRESHOLDS = {
  minCacheHitRatio: 80,  // in percent
  maxMemoryMB: 500,      // max memory usage allowed in MB
  maxEvictedKeys: 0,     // evicted keys threshold
};

export const monitorRedisAndClearCacheIfNeeded = async () => {
  try {
    const { data } = await axios.get(REDIS_STATS_URL);
    if (!data.success) {
      console.warn('Failed to get Redis stats');
      return;
    }

    const stats = data.data;
    console.log('Redis stats:', stats);

    const memoryHigh = Number(stats.memoryUsageMB) > THRESHOLDS.maxMemoryMB;

    if (memoryHigh) {
      console.log('Memory usage threshold breached, clearing Redis cache...');
      const clearResponse = await axios.post(CLEAR_REDIS_URL);
      if (clearResponse.data.success) {
        console.log('✅ Redis cache cleared successfully.');
      } else {
        console.warn('⚠️ Failed to clear Redis cache:', clearResponse.data.message);
      }
    } else {
      console.log('Redis memory usage within acceptable threshold. No action needed.');
    }
  } catch (error) {
    console.error('Error monitoring Redis or clearing cache:', error.message);
  }
};




//in limited case we can use this full monitoring function
// export const monitorRedisAndClearCacheIfNeeded = async () => {
//   try {
//     const { data } = await axios.get(REDIS_STATS_URL);
//     if (!data.success) {
//       console.warn('Failed to get Redis stats');
//       return;
//     }

//     const stats = data.data;
//     console.log('Redis stats:', stats);

//     // Check thresholds
//     const hitRatioLow = Number(stats.cacheHitRatioPercent) < THRESHOLDS.minCacheHitRatio;
//     const memoryHigh = Number(stats.memoryUsageMB) > THRESHOLDS.maxMemoryMB;
//     const evictedKeysHigh = Number(stats.evictedKeys) > THRESHOLDS.maxEvictedKeys;

//     if (hitRatioLow || memoryHigh || evictedKeysHigh) {
//       console.log('Threshold breached, clearing Redis cache...');
//       // Hit clear cache endpoint
//       const clearResponse = await axios.post(CLEAR_REDIS_URL);
//       if (clearResponse.data.success) {
//         console.log('✅ Redis cache cleared successfully.');
//       } else {
//         console.warn('⚠️ Failed to clear Redis cache:', clearResponse.data.message);
//       }
//     } else {
//       console.log('Redis stats within acceptable thresholds. No action needed.');
//     }
//   } catch (error) {
//     console.error('Error monitoring Redis or clearing cache:', error.message);
//   }
// };



/*---------------------------------------------------------------------------------*/