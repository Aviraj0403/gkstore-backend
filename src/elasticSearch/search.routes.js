import express from 'express';
import { searchFoods } from './search.controller.js';

const router = express.Router();

// Search endpoint
router.get('/search', async (req, res) => {
  const { query } = req.query;  // Get search query from frontend

  // Check if query exists
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query parameter is required and should be a non-empty string' });
  }

  try {
    const results = await searchFoods(query);
    res.status(200).json(results);
  } catch (error) {
    console.error('Error executing search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
