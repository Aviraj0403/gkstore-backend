import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  name: { type: String, required: false, trim: true }, // optional
  code: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true
  },
  discountPercentage: { type: Number, min: 0, max: 100 }, // optional
  maxDiscountAmount: { type: Number, default: null },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  applyAutomatically: { type: Boolean, default: false },

  // Usage tracking
  usageCount: { type: Number, default: 0 },
  maxUsageCount: { type: Number, default: 40 },
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

// offerSchema.index({ code: 1 });

const Offer = mongoose.model('Offer', offerSchema);
export default Offer;
