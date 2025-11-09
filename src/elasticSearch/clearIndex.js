import clientES from '../config/elasticsearch.js';

// Define max size in MB (adjust as needed)
const MAX_INDEX_SIZE_MB = 0;

const checkAndClearIndex = async () => {
  try {
    // Step 1: Check if the index exists
    const indexExists = await clientES.indices.exists({ index: 'foods' });
    if (!indexExists.body) {
      console.error("The 'foods' index does not exist.");
      return; // Exit if the index doesn't exist
    }

    // Step 2: Get the index stats
    const statsResponse = await clientES.indices.stats({
      index: 'foods',  // Specify the index name
    });

    console.log('Elasticsearch stats response:', statsResponse);

    // Check if the statsResponse contains 'foods' index stats
    const indexStats = statsResponse.body.indices && statsResponse.body.indices['foods'];
    if (!indexStats) {
      console.error("Could not find stats for 'foods' index.");
      return; // Exit if the stats are not found
    }

    const indexSizeInBytes = indexStats.total.store.size_in_bytes; // Size in bytes
    const indexSizeInMB = indexSizeInBytes / (1024 * 1024);  // Convert bytes to MB

    console.log(`Index size: ${indexSizeInMB} MB`);

    // Step 3: Check if the index exceeds the maximum size limit
    if (indexSizeInMB > MAX_INDEX_SIZE_MB) {
      console.log(`Index exceeded ${MAX_INDEX_SIZE_MB} MB. Proceeding to clear the index.`);
      await clearIndex();
    } else {
      console.log('Index size is within limits.');
    }

  } catch (error) {
    console.error('Error checking index size or clearing index:', error);
  }
};

// Function to clear the index (delete all documents but keep the index)
const clearIndex = async () => {
  try {
    console.log('Clearing index by deleting documents...');
    const response = await clientES.deleteByQuery({
      index: 'foods', // Index name
      body: {
        query: {
          match_all: {}, // Delete all documents
        },
      },
    });

    console.log('Index cleared successfully. Deleted documents count:', response.body.deleted);
  } catch (error) {
    console.error('Error clearing index:', error);
  }
};

// Function to delete the index entirely (including mapping and documents)
const deleteIndex = async () => {
  try {
    console.log('Deleting entire index...');
    const response = await clientES.indices.delete({
      index: 'foods', // Index name
    });
    console.log('Index deleted successfully:', response);
  } catch (error) {
    console.error('Error deleting index:', error);
  }
};

export default checkAndClearIndex;
