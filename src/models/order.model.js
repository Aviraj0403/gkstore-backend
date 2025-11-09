import mongoose from 'mongoose';

// Schema for individual items in an order
const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',  // Reference to the Product model
    required: true,
  },
  selectedVariant: {
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Variant',  // Reference to the Variant model
      required: true,
    },
    name: { 
      type: String, 
      required: true 
    },
    price: { 
      type: Number, 
      required: true 
    },
    size: { 
      type: String, 
      required: true  // Directly referencing the size from the selected variant
    }
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  }
}, { _id: false });

// Shipping address schema including location (Geospatial)
const locationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point',
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true,
  },
  formattedAddress: { type: String },
  placeId: { type: String }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // Reference to the User model
    required: true,
  },
  items: [orderItemSchema],

  shippingAddress: {
    label: { type: String },
    name: { type: String },
    email: { type: String },
    phoneNumber: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String, default: 'India' },
    location: locationSchema,  // ✅ Google Maps location
  },

  paymentMethod: {
    type: String,
    enum: ['COD', 'Online', 'Razorpay'],
    default: 'COD',
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Pending',
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },

  totalAmount: { 
    type: Number, 
    required: true,
    min: [0, 'Total amount must be a positive value'],
  },
  discountAmount: { 
    type: Number, 
    default: 0,
  },
  discountCode: { 
    type: String, 
    default: null, 
    uppercase: true, 
    trim: true,
  },
  offerApplied: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',  // Reference to the Offer model
    default: null,
  },
  isOfferApplied: { 
    type: Boolean, 
    default: false 
  },
  appliedDiscountPercentage: { 
    type: Number, 
    default: 0 
  },
  placedAt: { type: Date, default: Date.now },
  
  // Payment reference to handle payment details
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null,
  },

  // Optional: Order history (status updates over time)
  orderHistory: [{
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    },
    updatedAt: { type: Date, default: Date.now },
    notes: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  
}, {
  timestamps: true
});

// Index for location queries and discount codes
orderSchema.index({ 'shippingAddress.location': '2dsphere' });
orderSchema.index({ discountCode: 1 });

// JSON transformation to clean up unnecessary fields
orderSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    ret.finalAmount = ret.totalAmount - ret.discountAmount;  // Final total after applying discount
  },
});

const Order = mongoose.model('Order', orderSchema);
export default Order;
