import express from "express";
import {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
} from "../controllers/review.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = express.Router({ mergeParams: true }); // Important: allows :productId from parent

// Public: Get all reviews for a product (no auth needed)
router.get("/", getProductReviews);

// Authenticated routes
router.post("/", verifyToken, createReview);
router.patch("/:reviewId", verifyToken, updateReview);
router.delete("/:reviewId", verifyToken, deleteReview);

export default router;