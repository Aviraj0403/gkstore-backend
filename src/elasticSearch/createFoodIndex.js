import clientES from '../config/elasticsearch.js';

export const createFoodIndex = async () => {
  const indexName = 'foods';  // Declare the indexName here

  try {
    // Step 1: Check if the index exists
    const indexExists = await clientES.indices.exists({ index: indexName });

    if (indexExists.body) {
      // If index exists, delete it before creating again
      console.log(`Index '${indexName}' already exists. Deleting the existing index...`);
      await clientES.indices.delete({ index: indexName });
      console.log(`Index '${indexName}' deleted successfully.`);
    }

    // Step 2: Create the index with mappings
    const createResponse = await clientES.indices.create({
      index: indexName,
      body: {
        mappings: {
          properties: {
            name: { type: 'text' },
            description: { type: 'text' },
            ingredients: { type: 'keyword' },
            category: { type: 'keyword' },
            foodImages: { type: 'keyword' },
            isHotProduct: { type: 'boolean' },
            priceAfterDiscount: { type: 'float' },
            createdAt: { type: 'date' },
            suggest: { 
              type: 'completion',  // Added for autocomplete functionality
              analyzer: 'simple',
              preserve_separators: true,
              preserve_position_increments: true,
              max_input_length: 50
            },
          },
        },
      },
    });

    console.log(`Food index created successfully:`, createResponse);
  } catch (error) {
    // Catch the specific error if index already exists
    if (error.meta.body.error.type === 'resource_already_exists_exception') {
      console.error(`Index '${indexName}' already exists, skipping index creation.`);
    } else {
      console.error('Error creating or deleting the food index:', error);
    }
  }
};
