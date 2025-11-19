import mongoose from 'mongoose';

// Refined Variant Schema
const variantSchema = new mongoose.Schema({
  size: { 
    type: String, 
    required: [true, 'Size is required'],  
    trim: true
  },
  color: { 
    type: String, 
    required: [false, 'Color is required'],
    trim: true
  },
  price: { 
    type: Number, 
    required: [true, 'Price is required'], 
    min: [0, 'Price must be a positive value'],
  },
  stockQty: { 
    type: Number, 
    default: 0,
    min: [0, 'Stock quantity cannot be negative'],
  },
  packaging: { 
    type: String, 
    default: 'N/A',
    trim: true
  },
}, { _id: false });

// Export Variant Schema
export default variantSchema;