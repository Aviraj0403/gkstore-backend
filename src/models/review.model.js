import mongoose from 'mongoose';

// Define the Review Schema
const reviewSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', // Reference to the user who left the review
    required: true 
  },
  rating: {
    type: Number,
    required: true,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating must be at most 5'],
  },
  comment: { 
    type: String, 
    required: true, 
    minlength: [10, 'Review must be at least 10 characters long'],  // Minimum length of review comment
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
  },
}, { timestamps: true }); // This will automatically create `createdAt` and `updatedAt`

// Create the Review model
const Review = mongoose.model('Review', reviewSchema);

export default Review;
