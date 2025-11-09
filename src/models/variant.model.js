import mongoose from 'mongoose';

// Define the Variant Schema
const variantSchema = new mongoose.Schema({
  size: { 
    type: String, 
    required: true,  // E.g., "Small", "Medium", "Large"
  },
  color: { 
    type: String, 
    required: true, // E.g., "Ivory", "Sand", "Caramel"
  },
  price: { 
    type: Number, 
    required: true, 
    min: [0, 'Price must be a positive value'],
  },
  stockQty: { 
    type: Number, 
    default: 0,
    min: [0, 'Stock quantity cannot be negative'],
  },
  packaging: { 
    type: String, 
    default: 'Bottle',
  },
}, { _id: false }); // _id: false to avoid generating an _id for each variant, since it's embedded.

export default variantSchema;
