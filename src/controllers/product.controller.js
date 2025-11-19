import mongoose from "mongoose";
import slugify from "slugify";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";  // Assuming Products are related to category  
import cloudinary from '../config/cloudinaryConfig.js';  // Assuming Cloudinary is configured
import { promises as fs } from 'fs';
import client from '../config/redisClient.js'; // Redis client
import { uploadMultipleImagesToCloudinary, deleteImagesByUrlsFromCloudinary, uploadSingleImageToCloudinary } from './imageUpload.controller.js'; // Image upload helper
import { clearAllRedisCache, clearProductCache, clearMenuCache, clearCategoryAndCategoryProductsCache } from '../services/redis.service.js';
// import clientES from '../config/elasticsearch.js'; // Elasticsearch client
const generateProductCode = async (name) => {
  const base = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
  let code = `${base}-001`;
  let count = 1;

  while (await Product.findOne({ productCode: code })) {
    count++;
    code = `${base}-${count.toString().padStart(3, '0')}`;
  }
  return code;
};
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      subCategory,
      brand,
      description,
      variants = [],
      isFeatured = false,
      isHotProduct = false,
      isBestSeller = false,
      status = 'Active',
      discount = 0,
      tags = [],
      additionalInfo = {},
    } = req.body;
    // console.log("additionalInfo:", additionalInfo);
    const createdBy = req.user?.id;


    // ── Required Fields ─────────────────────────────────────────────────────
    if (!name || !category || !brand || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name, category, brand, and description are required.',
      });
    }

    // ── Variants Validation ─────────────────────────────────────────────────
    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one variant with price is required.',
      });
    }
    for (const v of variants) {
      if (!v.price || v.price <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Each variant must have a valid price.',
        });
      }
    }

    // ── Generate Unique Slug ───────────────────────────────────────────────
    let slug = slugify(name, { lower: true, strict: true });
    let counter = 1;
    while (await Product.findOne({ slug })) {
      slug = `${slugify(name, { lower: true, strict: true })}-${counter++}`;
    }

    // ── Generate Product Code ──────────────────────────────────────────────
    const productCode = await generateProductCode(name);

    // ── Process Tags ───────────────────────────────────────────────────────
    const tagArray = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim())
        : [];

    // ── Image Upload (1–5) ─────────────────────────────────────────────────
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required.',
      });
    }
    if (files.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 images allowed.',
      });
    }

    let imageUrls;
    try {
      imageUrls = await uploadMultipleImagesToCloudinary(files);
    } catch (uploadErr) {
      console.error('Image upload failed:', uploadErr);
      return res.status(500).json({
        success: false,
        message: 'Image upload failed. Please try again.',
      });
    }
    let parsedAdditionalInfo = additionalInfo;

    if (typeof req.body.additionalInfo === 'string') {
      // Parse only if it's a string
      parsedAdditionalInfo = JSON.parse(req.body.additionalInfo);
    }
    // ── Create Product ─────────────────────────────────────────────────────
    const newProduct = await Product.create({
      name,
      slug,
      category,
      subCategory: subCategory || null,
      brand,
      description,
      productCode,
      variants,
      pimages: imageUrls,
      discount,
      tags: tagArray,
      additionalInfo: parsedAdditionalInfo
      ,
      isFeatured,
      isHotProduct,
      isBestSeller,
      status,
      createdBy,
    });
    // console.log(newProduct.additionalInfo);
    // ── Clear Caches ───────────────────────────────────────────────────────
    await Promise.all([
      clearMenuCache(),
      clearProductCache(),
      clearCategoryAndCategoryProductsCache(),
    ]);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      product: newProduct,
    });
  } catch (error) {
    console.error('createProduct error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating product.',
    });
  }
};
export const updateProductImages = async (req, res) => {
  try {
    const { productId } = req.params;
    const files = req.files;

    // ── Validate Files ─────────────────────────────────────────────────────
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one image.',
      });
    }
    if (files.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 images allowed.',
      });
    }

    // ── Find Product ───────────────────────────────────────────────────────
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    // ── Delete Old Images ──────────────────────────────────────────────────
    if (product.pimages?.length > 0) {
      await deleteImagesByUrlsFromCloudinary(product.pimages);
    }

    // ── Upload New Images ──────────────────────────────────────────────────
    let newImageUrls;
    try {
      newImageUrls = await uploadMultipleImagesToCloudinary(files);
    } catch (uploadErr) {
      console.error('Image upload failed:', uploadErr);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload new images.',
      });
    }

    // ── Update Product ─────────────────────────────────────────────────────
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { pimages: newImageUrls },
      { new: true, runValidators: true }
    );

    // ── Clear Caches ───────────────────────────────────────────────────────
    await Promise.all([clearMenuCache(), clearProductCache()]);

    return res.json({
      success: true,
      message: 'Product images updated successfully.',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('updateProductImages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};
export const getAdminProduct = async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '', category } = req.query;
    const skip = (page - 1) * limit;
    let products = [];
    let totalProducts = 0;

    const categoryFilter = category ? { category } : {};


    if (search) {
      const textQuery = {
        ...categoryFilter,
        $text: { $search: search },
      };

      products = await Product.find(textQuery)
        .populate('category', 'name')
        .skip(Number(skip))
        .limit(Number(limit))
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .select({ score: { $meta: 'textScore' } })
        .lean();

      totalProducts = await Product.countDocuments(textQuery);

      if (products.length === 0) {
        const regexQuery = {
          ...categoryFilter,
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { tags: { $regex: search, $options: 'i' } },
          ],
        };

        products = await Product.find(regexQuery)
          .populate('category', 'name')
          .skip(Number(skip))
          .limit(Number(limit))
          .sort({ createdAt: -1 })
          .lean();

        totalProducts = await Product.countDocuments(regexQuery);
      }
    } else {
      // No search query, just filter by category
      const query = { ...categoryFilter };

      products = await Product.find(query)
        .populate('category', 'name') // Populate category
        .skip(Number(skip))
        .limit(Number(limit))
        .sort({ createdAt: -1 })
        .lean(); // Added lean here

      totalProducts = await Product.countDocuments(query);
    }

    // Prepare pagination data
    const pagination = {
      total: totalProducts,
      page: Number(page),
      totalPages: Math.ceil(totalProducts / limit),
      limit: Number(limit),
    };

    // Respond with product data and pagination
    res.json({
      success: true,
      products,
      pagination,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// redis instance
export const getAllProduct = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search = '',
      category,
      isHotProduct,
      isBestSeller,
      isFeatured
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = `products:${search || 'all'}:${category || 'none'}:${isHotProduct || 'none'}:${isBestSeller || 'none'}:${isFeatured || 'none'}:${pageNum}:${limitNum}`;

    try {
      const cachedProducts = await client.get(cacheKey);
      const cachedPagination = await client.get(`${cacheKey}:pagination`);

      if (cachedProducts && cachedPagination) {
        console.log('📦 Serving from Redis cache');
        return res.json({
          success: true,
          products: JSON.parse(cachedProducts),
          pagination: JSON.parse(cachedPagination),
        });
      }
    } catch (err) {
      console.warn('⚠️ Redis read failed:', err.message);
    }

    // Build aggregation...
    let pipeline = [];
    let matchStage = {};

    if (search) matchStage.$text = { $search: search };
    if (category && mongoose.isValidObjectId(category))
      matchStage.category = new mongoose.Types.ObjectId(category);
    if (isHotProduct === 'true') matchStage.isHotProduct = true;
    if (isBestSeller === 'true') matchStage.isBestSeller = true;
    if (isFeatured === 'true') matchStage.isFeatured = true;

    if (Object.keys(matchStage).length > 0) pipeline.push({ $match: matchStage });
    if (search) pipeline.push({ $addFields: { score: { $meta: 'textScore' } } });

    pipeline.push({
      $sort: search ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 }
    });

    pipeline.push({ $skip: skip }, { $limit: limitNum });

    const products = await Product.aggregate(pipeline);
    const totalProducts = await Product.countDocuments(matchStage);

    const pagination = {
      total: totalProducts,
      page: pageNum,
      totalPages: Math.ceil(totalProducts / limitNum),
      limit: limitNum,
    };

    try {
      await client.set(cacheKey, JSON.stringify(products), { EX: 3600 });
      await client.set(`${cacheKey}:pagination`, JSON.stringify(pagination), { EX: 3600 });
    } catch (err) {
      console.warn('⚠️ Redis write failed:', err.message);
    }

    return res.json({ success: true, products, pagination });

  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ success: false, message: 'An error occurred while fetching products.' });
  }
};

export const getMiniProductVersion = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search = '',
      category,
      isHotProduct,
      isBestSeller,
      isFeatured
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    // Cache Key (Optimized for quick access)
    const cacheKey = `mini-products:${search || 'all'}:${category || 'none'}:${isHotProduct || 'none'}:${isBestSeller || 'none'}:${isFeatured || 'none'}:${pageNum}:${limitNum}`;

    try {
      const cachedProducts = await client.get(cacheKey);

      if (cachedProducts) {
        console.log('📦 Serving from Redis cache');
        return res.json({
          success: true,
          products: JSON.parse(cachedProducts),
        });
      }
    } catch (err) {
      console.warn('⚠️ Redis read failed:', err.message);
    }

    // Build aggregation pipeline for mini version with filters
    let pipeline = [];
    let matchStage = {};

    // Apply search filter
    if (search) matchStage.$text = { $search: search };

    // Apply category filter (if category is passed)
    if (category && mongoose.isValidObjectId(category)) {
      matchStage.category = new mongoose.Types.ObjectId(category);
    }

    // Apply additional filters for hot products, best sellers, and featured products
    if (isHotProduct === 'true') matchStage.isHotProduct = true;
    if (isBestSeller === 'true') matchStage.isBestSeller = true;
    if (isFeatured === 'true') matchStage.isFeatured = true;

    // Add the match stage if any filters are present
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Optional: Adding a text score for search relevance if search is applied
    if (search) {
      pipeline.push({ $addFields: { score: { $meta: 'textScore' } } });
    }

    // Sorting logic (by relevance for search, otherwise by createdAt)
    pipeline.push({
      $sort: search ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 }
    });

    // Pagination (skip and limit)
    pipeline.push({ $skip: skip }, { $limit: limitNum });

    // Project only the necessary fields for mini version, including only the first variant with size, price, and realPrice
    pipeline.push({
      $project: {
        name: 1,
        slug: 1,
        description: 1,
        discount: 1,
        rating: 1,
        isBestSeller: 1,
        pimage: { $arrayElemAt: ["$pimages", 0] }, // Get the first image
        variants: { 
          $arrayElemAt: ["$variants", 0] // Get the first variant
        },
      }
    });

    // Add realPrice to the first variant
    pipeline.push({
      $addFields: {
        variants: {
          realPrice: {
            $multiply: [
              "$variants.price",
              { $add: [1, { $divide: ["$discount", 100] }] }  // Add the discount percentage to the original price
            ]
          }
        }
      }
    });

    // Further reduce the `variants` field to include only size, price, and realPrice
    pipeline.push({
      $project: {
        name: 1,
        slug: 1,
        description: 1,
        discount: 1,
        rating: 1,
        isBestSeller: 1,
        pimage: 1,
        variants: {
          size: 1,
          price: 1,
          realPrice: 1,
        },
      }
    });

    // Fetch data from MongoDB
    const products = await Product.aggregate(pipeline);

    // Fetch total product count (without pagination)
    const total = await Product.countDocuments(matchStage);

    // Format response
    const response = {
      success: true,
      products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    // Cache the response for future use (valid for 1 hour)
    try {
      await client.set(cacheKey, JSON.stringify(products), { EX: 3600 });
    } catch (err) {
      console.warn('⚠️ Redis write failed:', err.message);
    }

    return res.json(response);
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ success: false, message: 'An error occurred while fetching products.' });
  }
};

export const searchProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search = '',
      category,
      isHotProduct,
      isBestSeller,
      isFeatured
    } = req.query;

    // Pagination validation
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    let matchStage = {};

    // Full-text search
    if (search) {
      matchStage.$text = { $search: search };  // Full-text search for name, description, and tags
    }

    // Additional filters
    if (category) matchStage.category = mongoose.Types.ObjectId(category);
    if (isHotProduct) matchStage.isHotProduct = true;
    if (isBestSeller) matchStage.isBestSeller = true;
    if (isFeatured) matchStage.isFeatured = true;

    // Aggregation pipeline
    let pipeline = [{ $match: matchStage }];

    // Add text score sorting if search term exists
    if (search) {
      pipeline.push({
        $addFields: {
          score: { $meta: 'textScore' }
        }
      });
    }

    // Sorting: relevance first (if search term), else by createdAt
    pipeline.push({
      $sort: search ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 }
    });

    // Pagination
    pipeline.push({ $skip: skip }, { $limit: limitNum });

    // Projection: Fetch only necessary fields
    pipeline.push({
      $project: {
        name: 1,
        description: 1,
        pimages: 1,
        variants: 1,
        category: 1,
        isHotProduct: 1,
        isBestSeller: 1,
        isFeatured: 1,
        discount: 1,
        score: search ? { $meta: 'textScore' } : undefined
      }
    });

    // Execute the aggregation
    const products = await Product.aggregate(pipeline);

    // Get the total count for pagination (without skip/limit)
    const totalProducts = await Product.countDocuments(matchStage);

    // Pagination metadata
    const pagination = {
      total: totalProducts,
      page: pageNum,
      totalPages: Math.ceil(totalProducts / limitNum),
      limit: limitNum,
    };

    // Return response
    return res.json({ success: true, products, pagination });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'An error occurred while fetching products.' });
  }
};
export const getSearchSuggestions = async (req, res) => {
  try {
    // Destructure the query params with default values
    const { search = '', limit = 5 } = req.query;
    console.log('Search query for suggestions:', search);

    // If no search term is provided, return empty suggestions
    if (!search) return res.json({ success: true, suggestions: [] });

    // Escape special characters in the search term to prevent issues with regex
    const searchTerm = search.replace(/[.*+?^=!:${}()|\[\]\/\\]/g, '\\$&');

    // Aggregation pipeline for getting suggestions with a fallback regex search
    const pipeline = [
      {
        $match: {
          $text: { $search: searchTerm },  // Full-text search
        },
      },
      {
        $project: {
          name: 1,
          description: 1,
          pimages: 1,
          score: { $meta: 'textScore' },  // Rank by text relevance
        },
      },
      {
        $sort: { score: { $meta: 'textScore' } },  // Sort by text relevance
      },
      {
        $limit: Number(limit),  // Limit the number of suggestions
      },
    ];

    // Execute the aggregation pipeline to get text search results
    let suggestions = await Product.aggregate(pipeline);

    // If no results were found via full-text search, try fallback with regex
    if (suggestions.length === 0) {
      console.log('No results found with text search, attempting regex fallback...');

      const regexPipeline = [
        {
          $match: {
            $or: [
              { name: { $regex: searchTerm, $options: 'i' } },  // Case-insensitive regex for name
              { description: { $regex: searchTerm, $options: 'i' } },  // Case-insensitive regex for description
              { tags: { $regex: searchTerm, $options: 'i' } },  // Case-insensitive regex for tags
            ],
          },
        },
        {
          $project: {
            name: 1,
            description: 1,
            pimages: 1,
          },
        },
        {
          $limit: Number(limit),  // Limit the number of results for regex fallback
        },
      ];

      // Execute the fallback regex pipeline
      suggestions = await Product.aggregate(regexPipeline);
    }

    // Return the results as JSON
    return res.json({ success: true, suggestions });
  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    return res.status(500).json({ success: false, message: 'Error fetching search suggestions' });
  }
};

export const getUserProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search = '',
      category,
      sortBy = 'createdAt',
      sortOrder = -1,  // -1 for descending, 1 for ascending
      isHotProduct = false,
      isFeatured = false,
      isBestSeller = false,
    } = req.query;

    const skip = (page - 1) * limit;
    let products = [];
    let totalProducts = 0;

    // Build category filter part of the query
    const categoryFilter = category ? { category } : {};

    // Build filters for special sections (Hot Products, Featured, Best Sellers)
    const specialFilters = {
      ...(isHotProduct && { isHotProduct: true }),
      ...(isFeatured && { isFeatured: true }),
      ...(isBestSeller && { isBestSeller: true }),
    };

    // Combine all filters into one query object
    const query = {
      ...categoryFilter,
      ...specialFilters,
    };

    // If search query exists, perform full-text search
    if (search) {
      const textQuery = {
        ...query,
        $text: { $search: search },
      };

      products = await Product.find(textQuery)
        .populate('category', 'name') // Populate category name only
        .skip(Number(skip))
        .limit(Number(limit))
        .sort({ score: { $meta: 'textScore' }, [sortBy]: sortOrder })
        .select({ score: { $meta: 'textScore' } })
        .lean();

      totalProducts = await Product.countDocuments(textQuery);

      // Fallback to regex search if no matches found
      if (products.length === 0) {
        const regexQuery = {
          ...query,
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { tags: { $regex: search, $options: 'i' } },
          ],
        };

        products = await Product.find(regexQuery)
          .populate('category', 'name')
          .skip(Number(skip))
          .limit(Number(limit))
          .sort({ [sortBy]: sortOrder })
          .lean();

        totalProducts = await Product.countDocuments(regexQuery);
      }
    } else {
      // No search query, just fetch with other filters (category, hot products, etc.)
      products = await Product.find(query)
        .populate('category', 'name')
        .skip(Number(skip))
        .limit(Number(limit))
        .sort({ [sortBy]: sortOrder })
        .lean();

      totalProducts = await Product.countDocuments(query);
    }

    // Prepare pagination data
    const pagination = {
      total: totalProducts,
      page: Number(page),
      totalPages: Math.ceil(totalProducts / limit),
      limit: Number(limit),
    };

    // Respond with product data and pagination
    res.json({
      success: true,
      products,
      pagination,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    // console.log('Fetching product with ID:', productId);

    // Validate if 'productId' is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.',
      });
    }

    // Fetch the product from the database, including category and createdBy data
    const product = await Product.findById(productId)
      .populate('category', 'name')         // Populating the category field
      .populate('subCategory', 'name')      // Populating the subCategory field
      .populate('createdBy', 'userName')   // Populating the createdBy field to get userName
      .lean();                             // Use lean to return plain JavaScript objects
    // console.log('Fetched product:', product);
    // If product is not found
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    // Return the found product
    res.status(200).json({
      success: true,
      product: {
        ...product, // Spread the product object to include its properties
        createdBy: product.createdBy ? product.createdBy.userName : null, // Show the userName of the creator
      },
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the product. Please try again later.',
    });
  }
};
export const getUserProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // Validate if 'productId' is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.',
      });
    }

    // Fetch the product from the database, including category and createdBy data
    const product = await Product.findById(productId)
      .populate('category', 'name')         // Populating the category field
      .populate('subCategory', 'name')      // Populating the subCategory field
      .populate('createdBy', 'userName')   // Populating the createdBy field to get userName
      .lean();  // .lean() is used to get a plain JavaScript object instead of a mongoose document

    // If product is not found
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    // Return the found product
    const productWithDetails = {
      ...product, // Spread the product object to include its properties
      createdBy: product.createdBy ? product.createdBy.userName : null, // Show the userName of the creator
    };

    res.status(200).json({
      success: true,
      product: productWithDetails,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the product. Please try again later.',
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    let {
      name,
      category,
      subCategory,
      brand,
      description = '',
      variants = [],
      isFeatured = false,
      isHotProduct = false,
      isBestSeller = false,
      status = 'Active',
      discount = 0,
      tags = [],
      additionalInfo = {},
      removedImages = [],
    } = req.body;

    const files = req.files;
    if (typeof variants === 'string') variants = JSON.parse(variants);
    if (typeof removedImages === 'string') removedImages = JSON.parse(removedImages);
    if (typeof additionalInfo === 'string') additionalInfo = JSON.parse(additionalInfo);
    if (!name || !category || !brand || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name, category, brand, and description are required.',
      });
    }
    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one variant with price is required.',
      });
    }
    for (const v of variants) {
      if (!v.price || v.price <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Every variant must have a valid price.',
        });
      }
    }
    const tagArray = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
        ? tags.split(',').map(t => t.trim())
        : [];
    const existing = await Product.findById(productId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    let slug = existing.slug;
    if (name !== existing.name) {
      slug = slugify(name, { lower: true, strict: true });
      let counter = 1;
      while (await Product.findOne({ slug, _id: { $ne: productId } })) {
        slug = `${slugify(name, { lower: true, strict: true })}-${counter++}`;
      }
    }
    let productCode = existing.productCode;
    if (name !== existing.name) {
      productCode = await generateProductCode(name);
    }
    let finalImages = existing.pimages || [];
    if (Array.isArray(removedImages) && removedImages.length > 0) {
      finalImages = finalImages.filter(img => !removedImages.includes(img));
      await deleteImagesByUrlsFromCloudinary(removedImages);
    }
    if (files && files.length > 0) {
      if (finalImages.length + files.length > 5) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 5 images allowed.',
        });
      }
      const newUrls = await uploadMultipleImagesToCloudinary(files);
      finalImages = [...finalImages, ...newUrls];
    }
    const updatePayload = {
      name,
      slug,
      category,
      subCategory: subCategory || null,
      brand,
      description,
      productCode,
      variants,
      pimages: finalImages,
      discount,
      tags: tagArray,
      additionalInfo,
      isFeatured,
      isHotProduct,
      isBestSeller,
      status,
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updatePayload,
      { new: true, runValidators: true }
    );
    await Promise.all([
      clearMenuCache(),
      clearProductCache(),
      clearCategoryAndCategoryProductsCache(),
    ]);

    return res.json({
      success: true,
      message: 'Product updated successfully.',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('updateProduct error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    if (product.pimages?.length > 0) {
      await deleteImagesByUrlsFromCloudinary(product.pimages);
    }
    await Product.findByIdAndDelete(id);
    await Promise.all([
      clearMenuCache(),
      clearProductCache(),
      clearCategoryAndCategoryProductsCache(),
    ]);

    return res.json({
      success: true,
      message: 'Product and associated images deleted successfully.',
    });
  } catch (error) {
    console.error('deleteProduct error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product.',
    });
  }
};

export const getProductByCategory = async (req, res) => {
  try {
    const { category } = req.query;

    const products = await Product.find({ category }).limit(12).lean();

    res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching products by category.",
    });
  }
};

export const getTotalProduct = async (req, res) => {
  try {
    const total = await Product.countDocuments();

    res.status(200).json({
      success: true,
      totalProduct: total,
    });
  } catch (error) {
    console.error("Error fetching total products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch total product items.",
      error: error.message,
    });
  }
};

// ----------------------------------------
// Function to get products based on category slug
export const getProductsByCategorySlug = async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Cache Key (Optimized for quick access)
    const cacheKey = `category:${categorySlug}:page:${page}:limit:${limit}`;
    const cachedData = await client.get(cacheKey);

    if (cachedData) {
      console.log('📦 Serving products from cache');
      return res.json(JSON.parse(cachedData));
    }

    // Fetch the category by slug
    const category = await Category.findOne({ slug: categorySlug, isActive: true, isDeleted: false }).lean();
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Aggregate products in the category, apply pagination, and fetch necessary fields
    const aggregationPipeline = [
      {
        $match: { category: category._id, status: 'Active' }
      },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          pimage: { $arrayElemAt: ['$pimages', 0] },  // Get the first image
          name: 1,
          slug: 1,
          discount: 1,
          isBestSeller: 1,
          description: 1,
          rating: 1,
          variants: 1,  // Include variants
        }
      },
      // Add realPrice: original price + discount
      {
        $addFields: {
          variants: {
            $map: {
              input: "$variants",
              as: "variant",
              in: {
                $mergeObjects: [
                  "$$variant",
                  {
                    realPrice: {
                      $multiply: [
                        "$$variant.price",
                        { $add: [1, { $divide: ["$discount", 100] }] }  // Add the discount percentage to the original price
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },
      // Get only the first variant from each product
      {
        $project: {
          pimage: 1,
          name: 1,
          slug: 1,
          discount: 1,
          isBestSeller: 1,
          description: 1,
          rating: 1,
          variants: { $arrayElemAt: ["$variants", 0] },  // Get only the first variant
        }
      },
      // Final projection to return only necessary data
      {
        $project: {
          pimage: 1,
          name: 1,
          slug: 1,
          discount: 1,
          isBestSeller: 1,
          description: 1,
          rating: 1,
          variants: {
            size: 1,
            price: 1,
            realPrice: 1,  // Only include size, price, and realPrice
          },
        }
      },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'total' }]
        }
      }
    ];

    // Execute aggregation pipeline
    const result = await Product.aggregate(aggregationPipeline);

    // Extract total product count
    const total = result[0].totalCount[0]?.total || 0;

    // Format response
    const response = {
      success: true,
      products: result[0].data,
      categoryName: category.name,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };

    // Cache the response (valid for 1 hour)
    await client.set(cacheKey, JSON.stringify(response), { EX: 3600 });

    res.json(response);
  } catch (error) {
    console.error('Error fetching products by category slug:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
export const getProductsByCategoryAndSubCategorySlug = async (req, res) => {
  try {
    const { categorySlug, subCategorySlug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Cache Key (Optimized for quick access)
    const cacheKey = `category:${categorySlug}:subcategory:${subCategorySlug}:page:${page}:limit:${limit}`;
    const cachedData = await client.get(cacheKey);

    if (cachedData) {
      console.log('📦 Serving products from cache');
      return res.json(JSON.parse(cachedData));
    }

    // Fetch the category and subcategory details by their slugs
    const categoryAndSubCategory = await Category.aggregate([
      {
        $match: { slug: categorySlug, isActive: true, isDeleted: false },
      },
      {
        $lookup: {
          from: 'categories',  // Lookup in the same 'categories' collection for subcategories
          let: { parentCategoryId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$parentCategory', '$$parentCategoryId'] },
                slug: subCategorySlug,
                isActive: true,
                isDeleted: false,
              },
            },
            { $project: { _id: 1, name: 1 } },  // Include the subcategory name here
          ],
          as: 'subCategory',
        },
      },
      { $unwind: { path: '$subCategory', preserveNullAndEmptyArrays: false } },
      { $project: { categoryId: '$_id', categoryName: '$name', subCategoryId: '$subCategory._id', subCategoryName: '$subCategory.name' } },
    ]);

    if (categoryAndSubCategory.length === 0) {
      return res.status(404).json({ success: false, message: 'Category or Subcategory not found' });
    }

    const { categoryId, subCategoryId, categoryName, subCategoryName } = categoryAndSubCategory[0];

    // Now, fetch the products based on the categoryId and subCategoryId
    const aggregationPipeline = [
      {
        $match: {
          category: categoryId,
          subCategory: subCategoryId,
          status: 'Active',
        },
      },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          pimage: { $arrayElemAt: ['$pimages', 0] },  // Get the first image
          name: 1,
          slug: 1,
          discount: 1,
          isBestSeller: 1,
          description: 1,
          rating: 1,
          variants: 1,  // Include variants in the projection
        },
      },
      // Add realPrice (calculated by original price + discount)
      {
        $addFields: {
          variants: {
            $map: {
              input: '$variants',
              as: 'variant',
              in: {
                $mergeObjects: [
                  '$$variant',
                  {
                    realPrice: {
                      $multiply: [
                        '$$variant.price',
                        { $add: [1, { $divide: [{ $ifNull: ['$$variant.discount', 0] }, 100] }] }  // Add the discount percentage to the original price
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },
      // Get only the first variant and return only the size, price, and realPrice
      {
        $project: {
          pimage: 1,
          name: 1,
          slug: 1,
          discount: 1,
          isBestSeller: 1,
          description: 1,
          rating: 1,
          variants: {
            $arrayElemAt: ["$variants", 0],  // Get the first variant
          },
        }
      },
      {
        $project: {
          pimage: 1,
          name: 1,
          slug: 1,
          discount: 1,
          isBestSeller: 1,
          description: 1,
          rating: 1,
          variants: {
            size: 1,
            price: 1,
            realPrice: 1,  // Only include size, price, and realPrice
          },
        }
      },
      // Calculate the total number of matching products
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'total' }],
        },
      },
    ];

    // Execute the aggregation pipeline to fetch products
    const result = await Product.aggregate(aggregationPipeline);

    // Extract the total count of products
    const total = result[0].totalCount[0]?.total || 0;

    // Format the response
    const response = {
      success: true,
      products: result[0].data,
      categoryName,  // Include category name in the response
      subCategoryName,  // Include subcategory name in the response
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache the response (valid for 1 hour)
    await client.set(cacheKey, JSON.stringify(response), { EX: 3600 });

    // Return the response
    res.json(response);
  } catch (error) {
    console.error('Error fetching products by category and subcategory slug:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};





export const getSingleProduct = async (req, res) => {
  try {
    const { productSlug } = req.params; // Assuming slug is passed in the URL
    const cacheKey = `single-product:${productSlug}`;

    // Try to fetch data from cache
    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      console.log('📦 Serving product from cache');
      return res.json(JSON.parse(cachedData));
    }

    // Fetch the product by its slug
    const product = await Product.findOne({ slug: productSlug, status: 'Active' })
      .populate('category subCategory') // Populate category and subcategory details
      .lean(); // Convert to plain JS object to modify fields if needed

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Process the variants to include realPrice (price + discount)
    const processedVariants = product.variants.map(variant => {
      const realPrice = variant.price * (1 + product.discount / 100); // Apply discount to the price
      return {
        ...variant,
        realPrice, // Adding realPrice field
      };
    });

    // Prepare the response with additional information
    const response = {
      success: true,
      product: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        category: {
          _id: product.category._id,
          name: product.category.name,
          slug: product.category.slug,
        },
        subCategory: {
          _id: product.subCategory._id,
          name: product.subCategory.name,
          // slug: product.subCategory.slug,
        },
        brand: product.brand,
        description: product.description,
        productCode: product.productCode,
        variants: processedVariants, // Include variants with realPrice
        pimages: product.pimages, // Array of images
        discount: product.discount,
        rating: product.rating,
        reviewCount: product.reviewCount,
        status: product.status,
        isFeatured: product.isFeatured,
        isHotProduct: product.isHotProduct,
        isBestSeller: product.isBestSeller,
        tags: product.tags,
        additionalInfo: product.additionalInfo,
        reviews: product.reviews,
        createdBy: product.createdBy,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    };

    // Cache the product data for 1 hour (3600 seconds)
    await client.set(cacheKey, JSON.stringify(response), { EX: 3600 });

    return res.json(response);

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, message: 'An error occurred while fetching the product.' });
  }
};



