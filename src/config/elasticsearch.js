// utils/elasticsearch.js
import { Client } from '@elastic/elasticsearch';

// Create an Elasticsearch client instance
const clientES = new Client({
  node: 'http://168.231.122.13:9200',
  auth: {
    username: 'restro_user',
    password: 'newpassword',
  },
});

// Async ping to check connection
const checkConnection = async () => {
  try {
    await clientES.ping();
    console.log('Connected to Elasticsearch!');
  } catch (error) {
    console.error('Elasticsearch cluster is down!', error);
  }
};

checkConnection();

export default clientES;
