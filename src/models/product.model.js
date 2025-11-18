import mongoose from 'mongoose';
import variantSchema from './variant.model.js'; // Import variant schema
import Review from './review.model.js'; // Import Review model

const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Product name is required'], 
    trim: true,
    minlength: [3, 'Product name must be at least 3 characters long'],
    unique: true,
  },
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true,  // Slug for SEO-friendly URLs
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,  // Index category for faster lookups
  },
  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  },
  brand: { 
    type: String, 
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    required: [true, 'Product description is required'],
    minlength: [10, 'Description must be at least 10 characters long'],
  },
  productCode: { 
    type: String, 
    unique: true, 
    sparse: true 
  },
  variants: [variantSchema], // Store product variants as an array
  activeVariant: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Variant', 
    required: false,
  },
  pimages: {
    type: [String],
    required: [true, 'At least one image is required'],
    validate: {
      validator: function(v) {
        return v.length >= 1 && v.length <= 5;  // Limit to 1-5 images
      },
      message: 'A product must have between 1 to 5 images.',
    },
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount must be at least 0'],
    max: [100, 'Discount cannot exceed 100'],
  },
  rating: {
    type: Number,
    default: 4.3,
    min: [0, 'Rating must be between 0 and 5'],
    max: [5, 'Rating must be between 0 and 5'],
  },
  reviewCount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isHotProduct: {
    type: Boolean,
    default: false,
  },
  isBestSeller: {
    type: Boolean,
    default: false,
  },
  tags: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 10;  // Limit tags to 10
      },
      message: 'You can add up to 10 tags only.',
    },
  },
  additionalInfo: {
    skinType: { 
      type: String, 
      // required: [true, 'Skin type is required'], 
    },
    shelfLife: {
      type: Number,  // In months
      default: 12,
      min: [0, 'Shelf life cannot be negative'],
    },
    usageInstructions: {
      type: String,
      trim: true,
      // required: [true, 'Usage instructions are required'],
    },
  },
  reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
}, { timestamps: true });

// Indexing for better query performance
productSchema.index({ name: 1, slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isHotProduct: 1 });
productSchema.index({ tags: 'text', description: 'text' }, {
  weights: {
    name: 10,
    description: 5,
    ingredients: 1,
  }
});

// JSON transformation to clean up unnecessary fields
productSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    ret.priceAfterDiscount = ret.discount > 0 ? ret.price - (ret.price * (ret.discount / 100)) : ret.price;
  },
});

const Product = mongoose.model('Product', productSchema);

export default Product;
