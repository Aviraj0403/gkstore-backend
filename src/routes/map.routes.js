
import express from 'express';
const router = express.Router();
router.get('/map', async (req, res) => {
  const { lat, lon } = req.query;

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const data = await response.json();
    res.json(data); // Send the response back to the frontend
  } catch (err) {
    console.error('Error fetching address:', err);
    res.status(500).send('Error fetching address from Nominatim API');
  }
});

export default router;