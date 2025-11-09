import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point',
  },
  coordinates: {
    type: [Number], 
    required: false,
    default: [0, 0],
  },
  formattedAddress: { type: String },
  placeId: { type: String }
}, { _id: false });

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: false,
    unique: true,
  },
  userName: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  phoneNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    sparse: true,
  },
  password: {
    type: String,
    select: false,
    validate: {
      validator: function (value) {
        if (!this.firebaseUid && !value) return false;
        return true;
      },
      message: 'Password is required for custom registration.',
    },
  },
  roleType: {
    type: String,
    enum: ['customer', 'admin', 'deliveryBoy', 'user'],
    default: 'customer',
    required: true,
  },
  isVerified: { type: Boolean, default: false },
  avatar: { type: String, default: '', trim: true },

  addresses: [
    {
      _id: false,
      id: {
        type: mongoose.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId(),
      },
      location: locationSchema,
      label: { type: String, trim: true, default: 'Home' },
      name : { type: String },
      email : { type: String },
      phoneNumber: { type: String, trim: true },
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true, default: 'India' },
      isDefault: { type: Boolean, default: false }, // ✅ Google Maps location
    },
  ],

  resetOTP: { type: Number },
  otpExpiry: { type: Date },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
}, { timestamps: true });

userSchema.index({ 'addresses.location': '2dsphere' });

const User = mongoose.model('User', userSchema);
export default User;