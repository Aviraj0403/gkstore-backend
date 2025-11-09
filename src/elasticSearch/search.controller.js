import clientES from '../config/elasticsearch.js';

export const searchFoods = async (query) => {
  try {
    // Validate query
    if (!query || query.trim().length === 0) {
      throw new Error('Invalid query');
    }

    // Query Elasticsearch for suggestions and exact matches
    const response = await clientES.search({
      index: 'foods',  // The index to search
      body: {
        suggest: {
          food_suggest: {
            prefix: query,  // Prefix match for suggestions (autocomplete)
            completion: {
              field: 'suggest',  // The suggest field in your index
              size: 5,  // Return the top 5 suggestions
              fuzzy: {
                fuzziness: 'AUTO',  // Allow some fuzziness in matching (helps with typos)
              },
            },
          },
        },
        query: {
          bool: {
            should: [
              {
                multi_match: {
                  query: query,  // Match the query across multiple fields
                  fields: ['name^2', 'description', 'ingredients', 'category'],  // Boost name field
                  fuzziness: 'AUTO',  // Fuzziness to handle typos
                },
              },
            ],
          },
        },
      },
    });

    // Check if suggestions are available
    const suggestions = response.body?.suggest?.food_suggest[0]?.options || [];

    // If suggestions are found, return them
    if (suggestions.length > 0) {
      return suggestions.map((suggestion) => ({
        id: suggestion._id,
        name: suggestion._source.name,
        description: suggestion._source.description,
        ingredients: suggestion._source.ingredients,
        category: suggestion._source.category,
        price: suggestion._source.priceAfterDiscount[0],  // Assuming price is an array
        foodImages: suggestion._source.foodImages,
        createdAt: suggestion._source.createdAt,
      }));
    } else {
      // If no suggestions, fallback to exact matches
      const body = response.body || response;  // Ensure correct response structure

      // Handle no hits scenario
      if (!body || !body.hits || !body.hits.hits) {
        console.error('Unexpected response structure:', body);
        return [];  // Return empty array if no results
      }

      // Process search results and return them
      if (body.hits.hits.length > 0) {
        return body.hits.hits.map((hit) => ({
          id: hit._id,
          name: hit._source.name,
          description: hit._source.description,
          ingredients: hit._source.ingredients,
          category: hit._source.category,
          price: hit._source.priceAfterDiscount[0],  // Assuming price is an array
          foodImages: hit._source.foodImages,
          createdAt: hit._source.createdAt,
        }));
      } else {
        console.log('No results found for query:', query);
        return [];  // Return empty array if no results
      }
    }
  } catch (error) {
    console.error('Error executing search:', error);
    throw new Error('Search failed');
  }
};
