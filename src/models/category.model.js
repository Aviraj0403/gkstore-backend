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
    required: [true, 'Exactly two images are required'],
    validate: {
      validator: function (v) {
        return Array.isArray(v) && v.length === 2;  
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

// Pre-save hook for slug generation
categorySchema.pre('save', function(next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
  }
  next();
});

// Validation to prevent self-parenting
categorySchema.pre('save', async function(next) {
  if (this.parentCategory && this.parentCategory.toString() === this._id.toString()) {
    return next(new Error('Category cannot be its own parent'));
  }
  next();
});

categorySchema.index({ name: 'text', slug: 'text' });

const Category = mongoose.model('Category', categorySchema);

export default Category;