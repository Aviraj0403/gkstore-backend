// services/redis.service.js
import client from '../config/redisClient.js';

/**
 * Clears ALL Redis cache keys.
 * Use with caution — only for admin/debug.
 */
export const clearAllRedisCache = async () => {
  try {
    const keys = await client.keys('*');
    if (keys.length === 0) {
      return { success: true, message: 'No Redis keys found.', deletedCount: 0 };
    }

    const pipeline = client.multi();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();

    console.log(`Cleared ${keys.length} Redis keys.`);
    return { success: true, message: `Cleared ${keys.length} keys.`, deletedCount: keys.length };
  } catch (error) {
    console.error('Error clearing all Redis cache:', error);
    return { success: false, message: 'Failed to clear cache.', error: error.message };
  }
};

/**
 * Clears **menu/catalog** cache.
 * Used when categories or products change.
 */
export const clearMenuCache = async () => {
  try {
    const keys = await client.keys('menu:*');
    if (keys.length === 0) return;

    const pipeline = client.multi();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();

    console.log(`Cleared ${keys.length} menu cache keys.`);
  } catch (error) {
    console.error('Error clearing menu cache:', error);
  }
};

/**
 * Clears **product listing** cache (user-facing).
 * Used on product create/update/delete.
 */
export const clearProductCache = async () => {
  try {
    const keys = await client.keys('products:*');
    if (keys.length === 0) return;

    const pipeline = client.multi();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();

    console.log(`Cleared ${keys.length} product listing cache keys.`);
  } catch (error) {
    console.error('Error clearing product cache:', error);
  }
};

/**
 * Clears **category-specific product** cache.
 * Used when products in a category change.
 */
export const clearCategoryProductsCache = async (categoryId) => {
  try {
    const key = `categoryProducts:${categoryId}`;
    const deleted = await client.del(key);
    if (deleted) console.log(`Cleared category products cache: ${key}`);
  } catch (error) {
    console.error(`Error clearing category products cache for ${categoryId}:`, error);
  }
};

/**
 * Clears **all category-related caches**:
 * - `allCategories`
 * - `mainCategories`
 * - `categoryDetails:*`
 * - `categoryProducts:*`
 */
export const clearCategoryAndCategoryProductsCache = async () => {
  try {
    const keys = await client.keys('allCategories');
    keys.push(...await client.keys('mainCategories'));
    keys.push(...await client.keys('categoryDetails:*'));
    keys.push(...await client.keys('categoryProducts:*'));

    if (keys.length === 0) return;

    const pipeline = client.multi();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();

    console.log(`Cleared ${keys.length} category & product cache keys.`);
  } catch (error) {
    console.error('Error clearing category and product caches:', error);
  }
};

/**
 * Clears **search suggestions** cache.
 */
export const clearSearchSuggestionsCache = async () => {
  try {
    const keys = await client.keys('search:suggestions:*');
    if (keys.length === 0) return;

    const pipeline = client.multi();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();

    console.log(`Cleared ${keys.length} search suggestion cache keys.`);
  } catch (error) {
    console.error('Error clearing search suggestions cache:', error);
  }
};

/**
 * Clears **admin product list** cache.
 */
export const clearAdminProductCache = async () => {
  try {
    const keys = await client.keys('admin:products:*');
    if (keys.length === 0) return;

    const pipeline = client.multi();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();

    console.log(`Cleared ${keys.length} admin product cache keys.`);
  } catch (error) {
    console.error('Error clearing admin product cache:', error);
  }
};