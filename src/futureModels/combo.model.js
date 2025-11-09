import mongoose from 'mongoose';

const comboSchema = new mongoose.Schema({
  comboName: {
    type: String,
    required: true,
    trim: true,
  },
  comboPrice: {
    type: Number,
    required: true,
    min: 0,  
  },
  discount: {
    type: Number,
    default: 0,
    },
  foodItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',  
    required: true,  
  }],
  description: {
    type: String,
    default: "",
  },
  imageUrls: [{
    type: String,
    required: true,  
  }],
  isActive: {
    type: Boolean,
    default: true,  
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,  
  },
}, { timestamps: true });

// comboSchema.pre('save', async function(next) {
//   try {
//     const foodItems = await mongoose.model('Food').find({ '_id': { $in: this.foodItems } });
//     const totalPrice = foodItems.reduce((total, food) => total + food.price, 0);
//     this.comboPrice = totalPrice;  // Set combo price to the sum of the food items' prices
//     next();
//   } catch (err) {
//     next(err);
//   }
// });

const Combo = mongoose.model('Combo', comboSchema);

export default Combo;
