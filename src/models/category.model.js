import mongoose from 'mongoose';
const categorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Category name is required'], 
    unique: true, 
    trim: true 
  },
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  description: {
    type: String,
    trim: true,
    default: '', 
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null,
    validate: {
      validator: function(v) {
        return v === null || mongoose.Types.ObjectId.isValid(v);
      },
      message: props => `${props.value} is not a valid ObjectId!`
    },
    validate: {
      validator: async function(v) {
        if (v && v === this._id) {
          throw new Error("Category cannot be its own parent");
        }
        return true;
      },
      message: "Category cannot be its own parent"
    }
  },
  type: {
    type: String,
    enum: ['Main', 'Sub'],
    default: 'Main',
  },
  displayOrder: { 
    type: Number, 
    default: 0, 
  },
  image: {
    type: [String],
    required: true,
    validate: {
      validator: function (v) {
        return Array.isArray(v) && v.length === 2;  // Ensure exactly 2 images
      },
      message: 'Category must have exactly 2 images.'
    }
  },
  isActive: { 
    type: Boolean, 
    default: true, 
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  publicId: { 
    type: String, 
    default: null 
  },
}, { timestamps: true });

categorySchema.index({ name: 'text', slug: 'text' });

const Category = mongoose.model('Category', categorySchema);

export default Category;
