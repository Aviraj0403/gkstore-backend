import mongoose from 'mongoose';
import Order from './order.model.js';

const paymentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order', // Reference to the Order
    required: false,
  },
  paymentMethod: {
    type: String,
    enum: ['Razorpay', 'Cash', 'PayPal','Online'], // Add other payment gateways if needed
    required: true,
  },
  paymentId: {
    type: String,
    required: false, // Razorpay payment ID or equivalent from other gateways
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Pending',
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'INR', // Default to INR but can be adjusted based on payment method
  },
  transactionDate: {
    type: Date,
    default: Date.now,
  },
  razorpayOrderId: { // For Razorpay, you can store the Razorpay order ID
    type: String,
    default: null,
  },
  razorpayPaymentId: { // For Razorpay, you can store the Razorpay payment ID
    type: String,
    default: null,
  },
  razorpaySignature: { // For Razorpay, you can store the Razorpay signature
    type: String,
    default: null,
  },
  paymentGatewayResponse: { // To store any other response data from the payment gateway
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  paymentDetails: { // Additional details, can be useful for debugging, storing metadata, etc.
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  isRefunded: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true, // Automatically add createdAt and updatedAt timestamps
});

// Create and export the Payment model
const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
