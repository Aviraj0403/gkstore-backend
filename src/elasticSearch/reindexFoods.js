// utils/reindexFoods.js
import clientES from '../config/elasticsearch.js';
import Foods from '../models/food.model.js';  // Your MongoDB Food Model

// Function to reindex all foods into Elasticsearch
const reindexFoods = async () => {
  try {
    console.log('Fetching all food items from MongoDB...');

    // Fetch all food items from MongoDB (you can modify this query if needed)
    const foods = await Foods.find().lean(); // Adjust based on your query

    if (!foods || foods.length === 0) {
      console.log('No food items to index.');
      return;
    }

    console.log(`Reindexing ${foods.length} food items into Elasticsearch...`);

    // Prepare bulk indexing data
    const body = foods.flatMap(food => [
      { 
        index: { _index: 'foods', _id: food._id.toString() } 
      },
      {
        name: food.name,
        description: food.description,
        ingredients: food.ingredients,
        category: food.category.toString(),  // Ensure category is in a valid format
        foodImages: food.foodImages,
        isHotProduct: food.isHotProduct,
        priceAfterDiscount: food.discount > 0 ? food.variants.map(variant => variant.price - (variant.price * (food.discount / 100))) : food.variants.map(v => v.price),
        createdAt: food.createdAt,
      }
    ]);

    // Bulk insert into Elasticsearch
    const { body: bulkResponse } = await clientES.bulk({ body });

    if (bulkResponse.errors) {
      console.error('Errors occurred during bulk indexing');
    } else {
      console.log(`Successfully indexed ${bulkResponse.items.length} food items.`);
    }

  } catch (error) {
    console.error('Error while reindexing foods:', error);
  }
};

// Run the reindexing process
reindexFoods();
