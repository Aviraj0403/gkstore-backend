import mongoose from 'mongoose';
import variantSchema from './variant.model.js';
const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product', 
      required: true,
    },
    selectedVariant: variantSchema,
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    }
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',  // Reference to the User model
      required: true,
      unique: true, // one cart per user
    },
    items: [cartItemSchema],
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexing for performance
cartSchema.index({ user: 1 });



// Auto-update updatedAt when cart changes
cartSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Clean JSON response
cartSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret) => {
    delete ret.__v;
    return ret;
  },
});

// Model
const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
