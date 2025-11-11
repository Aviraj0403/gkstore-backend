import express from 'express';
import {
  createOffer,
  updateOffer,
  deleteOffer,
  getOfferById,
  getAllOffers,
  getActiveOffers,
  getActivePromoCodeOffers,
  validatePromoCode,
  applyDiscount,
} from '../controllers/offer.controller.js';
import { verifyToken } from '../middlewares/verifyToken.js'; 
import { authAdmin } from '../middlewares/authAdmin.js';
const router = express.Router();

// Public/Admin Routes
router.get('/offers', getAllOffers);                      // All offers
router.get('/offers/active', getActiveOffers);            // Auto + promo offers active
router.get('/offers/active/promos', getActivePromoCodeOffers); // Promo-code-based active offers
router.get('/offers/:id', getOfferById);                  // Single offer by ID
router.get('/offers/validate/:code',verifyToken, validatePromoCode);  // Validate promo code
router.post('/offers/apply-discount',verifyToken, applyDiscount);     // Apply promo code discount

// Admin-only Routes (ideally with middleware)
router.post('/offers',verifyToken, createOffer);                      // Create offer
router.put('/offers/:id', verifyToken,updateOffer);                   // Update offer
router.delete('/offers/:id',authAdmin, deleteOffer);                // Delete offer

export default router;
