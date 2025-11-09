import mongoose from 'mongoose';

// Schema for individual items in an order
const orderItemSchema = new mongoose.Schema({
  food: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Food',
    required: true,
  },
  // name: { type: String, required: true },
  selectedVariant: {
    name: { type: String },
    price: { type: Number },
    size: { type: String, enum: ['Small', 'Medium', 'Large'] },
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  }
}, { _id: false });

// Shipping address schema including location
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
    ref: 'User',
    required: true,
  },
  items: [orderItemSchema],

  shippingAddress: {
    label: { type: String },
    name : { type: String },
    email : { type: String },
    phoneNumber: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String, default: 'India' },
    location: locationSchema, // ✅ Google Maps location
  },

  paymentMethod: {
    type: String,
    enum: ['COD', 'Online','Razorpay'],
    default: 'COD'
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending'
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },

  totalAmount: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  discountCode: { type: String, default: null, uppercase: true, trim: true },
  offerApplied: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
    default: null
  },
  isOfferApplied: { type: Boolean, default: false },
  appliedDiscountPercentage: { type: Number, default: 0 },
  placedAt: { type: Date, default: Date.now },
  payment : {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null
  },
}, {
  timestamps: true
});

// Index for location queries and discount codes
orderSchema.index({ 'shippingAddress.location': '2dsphere' });
orderSchema.index({ discountCode: 1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;
