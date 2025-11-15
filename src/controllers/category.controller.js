import mongoose from "mongoose";
import Category from "../models/category.model.js";
import Product from "../models/product.model.js";
import cloudinary from '../config/cloudinaryConfig.js';
import { promises as fs } from 'fs';
import client from '../config/redisClient.js';
import { clearCategoryAndCategoryProductsCache, clearMenuCache } from '../services/redis.service.js';
import slugify from 'slugify';
import { deleteImagesByUrlsFromCloudinary } from "./imageUpload.controller.js";
const CACHE_EXPIRATION = 86400;
// CREATE CATEGORY
export const createCategory = async (req, res) => {
  try {
    const { name, description, parentCategory, type = 'Main', displayOrder = 0 } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required." });
    }

    if (type === 'Sub' && !parentCategory) {
      return res.status(400).json({ success: false, message: "Parent category is required for sub category." });
    }

    if (parentCategory) {
      const parent = await Category.findById(parentCategory);
      if (!parent) {
        return res.status(404).json({ success: false, message: "Parent category not found." });
      }
      if (parent.type !== 'Main') {
        return res.status(400).json({ success: false, message: "Parent category must be a main category." });
      }
    }

    // Generate unique slug
    let baseSlug = slugify(name, { lower: true, strict: true });
    let slug = baseSlug;
    let count = 1;
    while (await Category.findOne({ slug })) {
      slug = `${baseSlug}-${count++}`;
    }

    // Handle image uploads - expect exactly 2 images
    const files = req.files;
    if (!files || files.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "Exactly 2 images are required.",
      });
    }

    const imageUrls = [];
    const uploadedPublicIds = []; // Track for rollback

    for (const file of files) {
      try {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: "category_images",
          resource_type: "image",
          transformation: [
            { width: 800, height: 800, crop: "limit" },
            { quality: "auto" },
            { fetch_format: "webp" },
          ],
        });
        imageUrls.push(uploadResult.secure_url);
        uploadedPublicIds.push(uploadResult.public_id);
        await fs.unlink(file.path);
      } catch (uploadErr) {
        // console.error("Cloudinary Upload Error:", uploadErr);
        const rollbackUrls = imageUrls.slice(0, imageUrls.indexOf(uploadResult?.secure_url));
        await deleteImagesByUrlsFromCloudinary(rollbackUrls);
        return res.status(500).json({
          success: false,
          message: "Image upload failed. Please try again.",
        });
      }
    }

    const newCategory = await Category.create({
      name,
      slug,
      description,
      parentCategory: type === 'Sub' ? parentCategory : null,
      type,
      displayOrder,
      image: imageUrls, // Store only URLs
      isActive: true,
      isDeleted: false,
    });

    await Promise.all([clearCategoryAndCategoryProductsCache(), clearMenuCache()]);
    res.status(201).json({ success: true, category: newCategory });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};
// UPDATE CATEGORY
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parentCategory, type, displayOrder } = req.body;

    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found." });

    if (type === 'Sub' && !parentCategory) {
      return res.status(400).json({ success: false, message: "Parent category is required for sub category." });
    }

    if (parentCategory) {
      const parent = await Category.findById(parentCategory);
      if (!parent) {
        return res.status(404).json({ success: false, message: "Parent category not found." });
      }
      if (parent.type !== 'Main') {
        return res.status(400).json({ success: false, message: "Parent category must be a main category." });
      }
    }

    let imageUrls = category.image || [];

    // Handle new image uploads if provided
    const files = req.files;
    if (files && files.length > 0) {
      if (files.length !== 2) {
        return res.status(400).json({
          success: false,
          message: "Exactly 2 images are required for update.",
        });
      }

      // Delete old images using URLs
      if (imageUrls.length > 0) {
        await deleteImagesByUrlsFromCloudinary(imageUrls);
      }

      imageUrls = [];
      const uploadedPublicIds = [];

      for (const file of files) {
        try {
          const uploadResult = await cloudinary.uploader.upload(file.path, {
            folder: "category_images",
            resource_type: "image",
            transformation: [
              { width: 800, height: 800, crop: "limit" },
              { quality: "auto" },
              { fetch_format: "webp" },
            ],
          });
          imageUrls.push(uploadResult.secure_url);
          uploadedPublicIds.push(uploadResult.public_id);
          await fs.unlink(file.path);
        } catch (uploadErr) {
          console.error("Cloudinary Upload Error:", uploadErr);
          // Rollback partial uploads
          await deleteImagesByUrlsFromCloudinary(imageUrls);
          return res.status(500).json({
            success: false,
            message: "Image upload failed.",
          });
        }
      }
    }

    // Update slug if name changed
    let slug = category.slug;
    if (name && name !== category.name) {
      let baseSlug = slugify(name, { lower: true, strict: true });
      slug = baseSlug;
      let count = 1;
      while (await Category.findOne({ slug, _id: { $ne: id } })) {
        slug = `${baseSlug}-${count++}`;
      }
    }

    // Update fields
    category.name = name || category.name;
    category.slug = slug;
    category.description = description !== undefined ? description : category.description;
    category.parentCategory = type === 'Sub' ? parentCategory : null;
    category.type = type || category.type;
    category.displayOrder = displayOrder !== undefined ? displayOrder : category.displayOrder;
    category.image = imageUrls;

    await category.save();
    await Promise.all([clearCategoryAndCategoryProductsCache(), clearMenuCache()]);
    res.json({ success: true, category });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};
// RESTORE SOFT DELETED CATEGORY
export const restoreCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }
    if (!category.isDeleted) {
      return res.status(400).json({ success: false, message: "Category is not deleted." });
    }

    category.isDeleted = false;
    await category.save();

    await Category.updateMany(
      { parentCategory: id, isDeleted: true },
      { $set: { isDeleted: false } }
    );

    await Promise.all([clearCategoryAndCategoryProductsCache(), clearMenuCache()]);
    res.json({ success: true, message: "Category and its subcategories restored." });
  } catch (error) {
    console.error("Error restoring category:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// DELETE CATEGORY (HARD DELETE + CLOUDINARY CLEANUP)
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }

    // Delete images from Cloudinary
    if (category.image && category.image.length > 0) {
      await deleteImagesByUrlsFromCloudinary(category.image);
    }

    // Hard delete category, subcategories, and products
    await Category.deleteOne({ _id: id });
    await Category.deleteMany({ parentCategory: id });
    await Product.deleteMany({
      $or: [{ category: id }, { subCategory: id }]
    });

    await Promise.all([clearCategoryAndCategoryProductsCache(), clearMenuCache()]);
    res.json({ success: true, message: "Category, subcategories, products, and images deleted successfully." });
  } catch (error) {
    console.error("Error hard deleting category:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET ALL CATEGORIES (Admin)
export const getAllCategories = async (req, res) => {
  try {
    const cacheKey = 'allCategories';
    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      console.log('Serving all categories from cache');
      return res.json(JSON.parse(cachedData));
    }

    const categories = await Category.find()
      .sort({ displayOrder: 1 })
      .lean()
      .populate('parentCategory', 'name');

    const formattedCategories = categories.map(cat => {
      if (cat.parentCategory) {
        cat.parentCategory = cat.parentCategory.name;
      }
      return cat;
    });

    const response = { success: true, categories: formattedCategories };
    await client.set(cacheKey, JSON.stringify(response), { EX: CACHE_EXPIRATION });
    res.json(response);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET MAIN CATEGORIES (Public)
export const getMainCategories = async (req, res) => {
  try {
    const cacheKey = 'mainCategories';
    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      console.log('Serving main categories from cache');
      return res.json(JSON.parse(cachedData));
    }

    const categories = await Category.find({
      parentCategory: null,
      isActive: true,
      isDeleted: false
    }).sort({ displayOrder: 1 }).lean();

    const response = { success: true, categories };
    await client.set(cacheKey, JSON.stringify(response), { EX: CACHE_EXPIRATION });
    res.json(response);
  } catch (error) {
    console.error("Error fetching main categories:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET CATEGORY DETAILS 
export const getCategoryDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `categoryDetails:${id}`;
    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      console.log('Serving category details from cache');
      return res.json(JSON.parse(cachedData));
    }

    const mainCategory = await Category.findOne({
      _id: id,
      isActive: true,
      isDeleted: false
    }).select("name").lean();

    if (!mainCategory) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const subcategories = await Category.find({
      parentCategory: id,
      isActive: true,
      isDeleted: false
    }).sort({ displayOrder: 1 }).lean();

    const allCategoryIds = [id, ...subcategories.map(cat => cat._id)];
    const products = await Product.find({
      $or: [
        { category: { $in: allCategoryIds } },
        { subCategory: { $in: allCategoryIds } }
      ],
      status: 'Active'
    }).sort({ createdAt: -1 }).lean();

    const response = {
      success: true,
      categoryName: mainCategory.name,
      subcategories,
      products
    };

    await client.set(cacheKey, JSON.stringify(response), { EX: CACHE_EXPIRATION });
    res.json(response);
  } catch (error) {
    console.error("Error fetching category details:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET SINGLE CATEGORY
export const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id)
      .lean()
      .populate('parentCategory', 'name');

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }

    if (category.type === 'Sub' && category.parentCategory) {
      category.parentCategory = category.parentCategory.name;
    } else {
      category.parentCategory = null;
    }

    res.json({ success: true, category });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET CATEGORY PRODUCTS
export const getCategoryProducts = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const cacheKey = `categoryProducts:${categoryId}`;
    const cachedData = await client.get(cacheKey);

    if (cachedData) {
      console.log('Serving category products from cache');
      return res.json(JSON.parse(cachedData));
    }

    if (!mongoose.isValidObjectId(categoryId)) {
      return res.status(400).json({ success: false, message: 'Invalid category ID' });
    }

    const products = await Product.find({
      $or: [
        { category: categoryId },
        { subCategory: categoryId }
      ],
      status: 'Active'
    })
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .select('-__v')
      .lean();

    if (!products.length) {
      return res.status(404).json({ success: false, message: 'No products found in this category' });
    }

    const response = { success: true, products };
    await client.set(cacheKey, JSON.stringify(response), { EX: CACHE_EXPIRATION });
    res.json(response);
  } catch (error) {
    console.error('Error fetching category products:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET SUBCATEGORIES BY PARENT
export const getSubCategories = async (req, res) => {
  try {
    const { parentCategoryId } = req.params;

    if (!mongoose.isValidObjectId(parentCategoryId)) {
      return res.status(400).json({ success: false, message: 'Invalid parent category ID.' });
    }

    const parentCategory = await Category.findById(parentCategoryId);
    if (!parentCategory) {
      return res.status(404).json({ success: false, message: 'Parent category not found.' });
    }

    const subcategories = await Category.find({
      parentCategory: parentCategoryId,
      isActive: true,
      isDeleted: false,
    }).sort({ displayOrder: 1 }).lean();

    if (subcategories.length === 0) {
      return res.status(404).json({ success: false, message: 'No subcategories found for this parent category.' });
    }

    res.json({ success: true, subcategories });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};


// --Product fetching based on category and subcategory--

// 1. Get all products directly in a main category (excluding those in subcategories) - using slug
export const getProductsByMainCategoryDirectSlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Default to 20 for e-commerce
    const skip = (page - 1) * limit;

    const cacheKey = `products_main_direct:${slug}:p${page}:l${limit}`;
    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      console.log('📦 Serving direct main category products from cache');
      return res.json(JSON.parse(cachedData));
    }

    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug is required' });
    }

    const category = await Category.findOne({
      slug,
      type: 'Main',
      isActive: true,
      isDeleted: false
    }).lean();

    if (!category) {
      return res.status(404).json({ success: false, message: 'Main category not found' });
    }

    const products = await Product.find({
      category: category._id,
      subCategory: null, // Direct products only (no subcategory)
      status: 'Active'
    })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments({
      category: category._id,
      subCategory: null,
      status: 'Active'
    });

    const response = {
      success: true,
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };

    await client.set(cacheKey, JSON.stringify(response), { EX: CACHE_EXPIRATION });
    res.json(response);
  } catch (error) {
    console.error('Error fetching direct main category products:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 2. Get all products in a subcategory - using slug
export const getProductsBySubCategorySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const cacheKey = `products_sub:${slug}:p${page}:l${limit}`;
    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      console.log('📦 Serving subcategory products from cache');
      return res.json(JSON.parse(cachedData));
    }

    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug is required' });
    }

    const category = await Category.findOne({
      slug,
      type: 'Sub',
      isActive: true,
      isDeleted: false
    }).lean();

    if (!category) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }

    const products = await Product.find({
      $or: [
        { category: category._id },
        { subCategory: category._id }
      ],
      status: 'Active'
    })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments({
      $or: [
        { category: category._id },
        { subCategory: category._id }
      ],
      status: 'Active'
    });

    const response = {
      success: true,
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };

    await client.set(cacheKey, JSON.stringify(response), { EX: CACHE_EXPIRATION });
    res.json(response);
  } catch (error) {
    console.error('Error fetching subcategory products:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 3. Get all products in a main category and its subcategories - using slug
export const getProductsByCategoryAndSubsSlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const cacheKey = `products_category_with_subs:${slug}:p${page}:l${limit}`;
    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      console.log('📦 Serving category with subs products from cache');
      return res.json(JSON.parse(cachedData));
    }

    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug is required' });
    }

    const mainCategory = await Category.findOne({
      slug,
      type: 'Main',
      isActive: true,
      isDeleted: false
    }).lean();

    if (!mainCategory) {
      return res.status(404).json({ success: false, message: 'Main category not found' });
    }

    const subcategories = await Category.find({
      parentCategory: mainCategory._id,
      isActive: true,
      isDeleted: false
    }).select('_id').lean();

    const allCategoryIds = [mainCategory._id, ...subcategories.map(cat => cat._id)];

    const products = await Product.find({
      $or: [
        { category: { $in: allCategoryIds } },
        { subCategory: { $in: allCategoryIds } }
      ],
      status: 'Active'
    })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments({
      $or: [
        { category: { $in: allCategoryIds } },
        { subCategory: { $in: allCategoryIds } }
      ],
      status: 'Active'
    });

    const response = {
      success: true,
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };

    await client.set(cacheKey, JSON.stringify(response), { EX: CACHE_EXPIRATION });
    res.json(response);
  } catch (error) {
    console.error('Error fetching category and subcategories products:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET CATEGORY WITH SUBCATEGORIES BY SLUG
export const getCategoryWithSubsBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const cacheKey = `category_with_subs:${slug}`;
    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      console.log('Serving category + subs from cache');
      return res.json(JSON.parse(cachedData));
    }

    const mainCategory = await Category.findOne({
      slug,
      type: 'Main',
      isActive: true,
      isDeleted: false
    }).select('name slug image').lean();

    if (!mainCategory) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const subcategories = await Category.find({
      parentCategory: mainCategory._id,
      isActive: true,
      isDeleted: false
    })
      .sort({ displayOrder: 1 })
      .select('name slug image')
      .lean();

    const response = {
      success: true,
      category: {
        name: mainCategory.name,
        slug: mainCategory.slug,
        image: mainCategory.image
      },
      subcategories
    };

    await client.set(cacheKey, JSON.stringify(response), { EX: CACHE_EXPIRATION });
    res.json(response);
  } catch (error) {
    console.error('Error fetching category with subcategories:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

