// controllers/review.controller.js
import mongoose from 'mongoose';
import Review from '../models/review.model.js';
import Product from '../models/product.model.js';


// CREATE REVIEW
export const createReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;               // from JWT auth middleware

    // ---- validation -------------------------------------------------
    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating and comment are required.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.',
      });
    }

    const product = await Product.findById(productId);
    if (!product || product.status !== 'Active') {
      return res.status(404).json({
        success: false,
        message: 'Product not found or inactive.',
      });
    }

    // ---- one review per user ---------------------------------------
    const existing = await Review.findOne({ product: productId, user: userId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product.',
      });
    }

    // ---- create ----------------------------------------------------
    const review = await Review.create({
      product: productId,
      user: userId,
      rating: Number(rating),
      comment: comment.trim(),
    });

    // ---- recalc product rating --------------------------------------
    await recalcProductRating(productId);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully.',
      review,
    });
  } catch (error) {
    console.error('createReview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit review.',
    });
  }
};


// GET REVIEWS FOR A PRODUCT (paginated)
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.',
      });
    }

    const [reviews, total] = await Promise.all([
      Review.find({ product: productId })
        .populate('user', 'userName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments({ product: productId }),
    ]);

    res.json({
      success: true,
      reviews,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('getProductReviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews.',
    });
  }
};


// UPDATE REVIEW (owner only)
export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating and comment are required.',
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.',
      });
    }

    if (review.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own reviews.',
      });
    }

    review.rating = Number(rating);
    review.comment = comment.trim();
    await review.save();

    await recalcProductRating(review.product);

    res.json({
      success: true,
      message: 'Review updated.',
      review,
    });
  } catch (error) {
    console.error('updateReview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review.',
    });
  }
};


// DELETE REVIEW (owner or admin)
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';   // assuming role field

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.',
      });
    }

    const isOwner = review.user.toString() === userId;
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this review.',
      });
    }

    const productId = review.product;
    await Review.findByIdAndDelete(reviewId);

    await recalcProductRating(productId);

    res.json({
      success: true,
      message: 'Review deleted.',
    });
  } catch (error) {
    console.error('deleteReview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review.',
    });
  }
};

/* -----------------------------------------------------------------
   Helper – recalculate product rating & reviewCount
   ----------------------------------------------------------------- */
const recalcProductRating = async (productId) => {
  const stats = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const product = await Product.findById(productId);
  if (product) {
    product.rating = stats[0] ? Number(stats[0].avgRating.toFixed(1)) : 0;
    product.reviewCount = stats[0]?.totalReviews || 0;
    await product.save();
  }
};