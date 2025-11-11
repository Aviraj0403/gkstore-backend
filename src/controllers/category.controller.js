import mongoose from "mongoose";
import Category from "../models/category.model.js";
import Product from "../models/product.model.js";
import cloudinary from '../config/cloudinaryConfig.js';
import { promises as fs } from 'fs';
import client from '../config/redisClient.js';
import { clearAllRedisCache, clearProductCache, clearMenuCache, clearCategoryAndCategoryProductsCache } from '../services/redis.service.js';
import slugify from 'slugify';

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
    const publicIds = [];

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
        publicIds.push(uploadResult.public_id);

        // Delete local file
        await fs.unlink(file.path);
      } catch (uploadErr) {
        console.error("❌ Cloudinary Upload Error:", uploadErr);
        // Clean up partial uploads
        for (const pid of publicIds) {
          await cloudinary.uploader.destroy(pid);
        }
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
      image: imageUrls,
      publicId: publicIds.join(','),
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

    let imageUrls = category.image;
    let publicIds = category.publicId ? category.publicId.split(',') : [];

    // Handle new image uploads if provided - replace all
    const files = req.files;
    if (files && files.length > 0) {
      if (files.length !== 2) {
        return res.status(400).json({
          success: false,
          message: "Exactly 2 images are required for update.",
        });
      }

      // Delete old images
      for (const pid of publicIds) {
        try {
          await cloudinary.uploader.destroy(pid);
        } catch (err) {
          console.warn(`Failed to delete old Cloudinary image: ${err.message}`);
        }
      }

      imageUrls = [];
      publicIds = [];

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
          publicIds.push(uploadResult.public_id);

          await fs.unlink(file.path);
        } catch (uploadErr) {
          console.error("❌ Cloudinary Upload Error:", uploadErr);
          // Clean up partial
          for (const pid of publicIds) {
            await cloudinary.uploader.destroy(pid);
          }
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

    category.name = name || category.name;
    category.slug = slug;
    category.description = description !== undefined ? description : category.description;
    category.parentCategory = type === 'Sub' ? parentCategory : null;
    category.type = type || category.type;
    category.displayOrder = displayOrder !== undefined ? displayOrder : category.displayOrder;
    category.image = imageUrls;
    category.publicId = publicIds.join(',');

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

    // Restore the category (set isDeleted to false)
    category.isDeleted = false;
    await category.save();

    // Restore subcategories if needed
    await Category.updateMany(
      { parentCategory: id, isDeleted: true },
      { $set: { isDeleted: false } }
    );

    res.json({ success: true, message: "Category and its subcategories restored." });
  } catch (error) {
    console.error("Error restoring category:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};


// DELETE CATEGORY (SOFT DELETE)
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }

    // Soft delete the category
    category.isDeleted = true;
    await category.save();

    // Soft delete subcategories
    await Category.updateMany(
      { parentCategory: id, isDeleted: false }, // Only soft delete subcategories that are not already deleted
      { $set: { isDeleted: true } }
    );

    // Nullify references in Product (marking category and subcategory as deleted)
    await Product.updateMany(
      { $or: [{ category: id }, { subCategory: id }] },
      { $set: { category: null, subCategory: null } }
    );

    // Clear cache after deletion
    await Promise.all([clearCategoryAndCategoryProductsCache(), clearMenuCache()]);

    res.json({ success: true, message: "Category and its subcategories soft deleted." });
  } catch (error) {
    console.error("Error soft deleting category:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};


// GET ALL CATEGORIES (for admin, no filter)
export const getAllCategories = async (req, res) => {
  try {
    const cacheKey = 'allCategories';

    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      console.log('📦 Serving categories from cache');
      return res.json(JSON.parse(cachedData));
    }

    const categories = await Category.find().sort({ displayOrder: 1 }).lean();

    const response = { success: true, categories };

    await client.set(cacheKey, JSON.stringify(response), { EX: CACHE_EXPIRATION });

    res.json(response);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET MAIN CATEGORIES (for user, filter active)
export const getMainCategories = async (req, res) => {
  try {
    const cacheKey = 'mainCategories';

    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      console.log('📦 Serving main categories from cache');
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
      console.log('📦 Serving category details from cache');
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
    const category = await Category.findById(id).lean();
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found." });
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
      console.log('📦 Serving category products from cache');
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


// GET SUBCATEGORIES BY PARENT CATEGORY ID
export const getSubCategories = async (req, res) => {
  try {
    const { parentCategoryId } = req.params;

    // Check if the parentCategoryId is a valid ObjectId
    if (!mongoose.isValidObjectId(parentCategoryId)) {
      return res.status(400).json({ success: false, message: 'Invalid parent category ID.' });
    }

    // Find the parent category
    const parentCategory = await Category.findById(parentCategoryId);
    if (!parentCategory) {
      return res.status(404).json({ success: false, message: 'Parent category not found.' });
    }

    // Get the subcategories of the parent category
    const subcategories = await Category.find({
      parentCategory: parentCategoryId,
      isActive: true,
      isDeleted: false,
    }).sort({ displayOrder: 1 }).lean();

    if (subcategories.length === 0) {
      return res.status(404).json({ success: false, message: 'No subcategories found for this parent category.' });
    }

    // Respond with the subcategories
    res.json({ success: true, subcategories });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};
