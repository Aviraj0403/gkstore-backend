import client from '../config/redisClient.js'; 

export const clearAllRedisCache = async () => {
  try {
    const keys = await client.keys('*');

    if (keys.length === 0) {
      return {
        success: true,
        message: 'No Redis keys to delete.',
        deletedCount: 0,
      };
    }

    const pipeline = client.multi();
    keys.forEach((key) => pipeline.del(key));
    await pipeline.exec();

    return {
      success: true,
      message: `Cleared ${keys.length} Redis keys.`,
      deletedCount: keys.length,
    };
  } catch (error) {
    console.error('❌ Error clearing Redis cache:', error);
    return {
      success: false,
      message: 'Error clearing Redis cache.',
      error,
    };
  }
};
export const clearMenuCache = async () => {
  try {
    const keys = await client.keys('menu:*');
    if (keys.length === 0) {
      console.log('ℹ️ No menu cache keys to delete.');
      return;
    }

    const pipeline = client.multi();
    keys.forEach((key) => pipeline.del(key));
    await pipeline.exec();

    console.log(`✅ Cleared ${keys.length} menu cache keys.`);
  } catch (error) {
    console.error('❌ Error clearing menu cache:', error);
  }
}
export const clearFoodCache = async () => {
  try {
    const keys = await client.keys('foods:*');
    if (keys.length === 0) {
      console.log('ℹ️ No food cache keys to delete.');
      return;
    }

    const pipeline = client.multi();
    keys.forEach((key) => pipeline.del(key));
    await pipeline.exec();

    console.log(`✅ Cleared ${keys.length} food cache keys.`);
  } catch (error) {
    console.error('❌ Error clearing food cache:', error);
  }
};
export const clearCategoryAndCategoryFoodsCache = async () => {
  try {
    const keys = await client.keys('categoryFoods:*');
    keys.push('allCategories');

    if (keys.length === 0) {
      console.log('ℹ️ No category or category foods cache keys to delete.');
      return;
    }

    const pipeline = client.multi();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();

    console.log(`✅ Cleared ${keys.length} category and category foods cache keys.`);
  } catch (error) {
    console.error('❌ Error clearing category cache:', error);
  }
};
