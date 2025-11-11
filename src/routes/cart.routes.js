import express from 'express';
import { 
  getUserCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart 
} from '../controllers/cart.controller.js';
import { verifyToken } from '../middlewares/verifyToken.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get the current user's cart
router.get('/', getUserCart);

// Add or update an item in the cart
router.post('/', addToCart);

// Update the quantity of an item in the cart
router.put('/:productId/:variantId', updateCartItem);

// Remove a specific item from the cart
router.delete('/:productId/:variantId', removeCartItem);

// Clear the entire cart
router.delete('/', clearCart);

export default router;
