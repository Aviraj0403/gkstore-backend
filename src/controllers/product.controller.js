import mongoose from "mongoose";
import slugify from "slugify";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";  // Assuming Products are related to category  
import cloudinary from '../config/cloudinaryConfig.js';  // Assuming Cloudinary is configured
import { promises as fs } from 'fs';
import client from '../config/redisClient.js'; // Redis client
import { uploadMultipleImagesToCloudinary, deleteImagesByUrlsFromCloudinary, uploadSingleImageToCloudinary } from './imageUploadController.js'; // Image upload helper
import { clearAllRedisCache ,clearProductCache ,clearMenuCache,clearCategoryAndCategoryProductsCache} from '../services/redis.service.js'; 
// import clientES from '../config/elasticsearch.js'; // Elasticsearch client
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      subCategory,
      brand,
      description = "",
      productCode,
      variants = [],
      isFeatured = false,
      isHotProduct = false,
      isBestSeller = false,
      status = "Active",
      discount = 0,
      price,
      tags = [],
      additionalInfo = {},
      // createdBy = "admin", // Replace with real user ID in production
    } = req.body;
    const createdBy = req.user.id;
    // ✅ Validate required fields
    if (!name || !category || !brand || !description || !price) {
      return res.status(400).json({
        success: false,
        message: "Name, category, brand, description, and price are required.",
      });
    }

    // ✅ Generate slug if not provided
    let slug = req.body.slug || slugify(name, { lower: true, strict: true });

    // ✅ Process tags
    let tagArray = [];
    if (typeof tags === "string") {
      tagArray = tags.split(",").map((t) => t.trim());
    } else if (Array.isArray(tags)) {
      tagArray = tags;
    }

    // ✅ Validate variants
    if (!Array.isArray(variants)) {
      return res.status(400).json({
        success: false,
        message: "Variants must be an array.",
      });
    }

    // ✅ Handle file uploads
    const files = req.files; // multer adds this
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one image.",
      });
    }
    if (files.length > 5) {
      return res.status(400).json({
        success: false,
        message: "You can upload up to 5 images only.",
      });
    }

    const imageUrls = [];

    for (const file of files) {
      try {
        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: "product_images",
          resource_type: "image",
          transformation: [
            { width: 800, height: 800, crop: "limit" },
            { quality: "auto" },
            { fetch_format: "webp" },
          ],
        });

        imageUrls.push(uploadResult.secure_url);

        // Delete local file after upload
        fs.unlink(file.path);
      } catch (uploadErr) {
        console.error("❌ Cloudinary Upload Error:", uploadErr);
        // Clean up uploaded images if partial upload
        for (const uploaded of imageUrls) {
          const publicId = uploaded.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(`product_images/${publicId}`);
        }
        return res.status(500).json({
          success: false,
          message: "Image upload failed. Please try again.",
        });
      }
    }

    // ✅ Create product in DB
    const newProduct = await Product.create({
      name,
      slug,
      category,
      subCategory,
      brand,
      description,
      productCode,
      pimages: imageUrls,
      variants,
      isFeatured,
      isHotProduct,
      isBestSeller,
      status,
      discount,
      price,
      tags: tagArray,
      additionalInfo,
      createdBy,
    });

  
    //   await clientES.index({
    //   index: 'products',  
    //   id: newProduct._id.toString(),  
    //   body: {
    //     name: newProduct.name,
    //     description: newProduct.description,
    //     tags: newProduct.tags,
    //     category: newProduct.category.toString(),
    //     pimages: newProduct.pimages,
    //     isHotProduct: newProduct.isHotProduct,
    //     suggest: {
    //       input: [newProduct.name,newProduct.category],  
    //       weight: 1,  
    // },
    //     priceAfterDiscount: newProduct.discount > 0 ? newProduct.price - (newProduct.price * (newProduct.discount / 100)) : newProduct.price,
    //     createdAt: newProduct.createdAt,
    //   },
    // });
    await Promise.all([clearMenuCache(), clearProductCache(),clearCategoryAndCategoryProductsCache()]);
    return res.status(201).json({
      success: true,
      message: "✅ Product created successfully.",
      product: newProduct,
    });
  } catch (error) {
    console.error("❌ Error in createProduct:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating product.",
    });
  }
};

export const updateProductImages = async (req, res) => {
    try {
        const { productId } = req.params;
        const files = req.files;  // Get the files uploaded via form-data

        // Check if files are provided
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please upload at least one image.",
            });
        }

        // Fetch the product to know its existing images
        const productItem = await Product.findById(productId);
        if (!productItem) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        // Delete previous images from Cloudinary (if any)
        if (productItem.pimages && productItem.pimages.length > 0) {
            await deleteImagesByUrlsFromCloudinary(productItem.pimages);
        }

        // Upload new images to Cloudinary (supporting both single and multiple images)
        const imageUrls = await uploadMultipleImagesToCloudinary(files); // This will handle both single and multiple images

        // Update the product with new image URLs
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { pimages: imageUrls },  // Update with the new image URLs
            { new: true }
        );
        await Promise.all([clearMenuCache(), clearProductCache()]);
        res.status(200).json({
            success: true,
            message: "Product images updated successfully.",
            product: updatedProduct,
        });
    } catch (error) {
        console.error("Error updating product images:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error occurred while updating the product images."
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
        .populate('category' ,'name') 
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
        .populate('category' ,'name') // Populate category
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

export const getMenuProduct = async (req, res) => {
  const cacheKey = "menu:products"; // single key since it’s the whole catalog

  try {
    // ✅ 1) Check Redis cache first
    try {
      const cachedMenu = await client.get(cacheKey);
      if (cachedMenu) {
        console.log("📦 Serving catalog from Redis cache");
        return res.json({
          success: true,
          products: JSON.parse(cachedMenu),
          fromCache: true,
        });
      }
    } catch (cacheErr) {
      console.warn("⚠️ Redis read failed:", cacheErr.message);
    }

    // ✅ 2) Fetch all active categories
    const categories = await Category.find({ isActive: true, isDeleted: false })
      .sort({ displayOrder: 1 })
      .lean();

    if (!categories.length) {
      return res
        .status(404)
        .json({ success: false, message: "No categories found" });
    }

    // ✅ 3) Fetch all active products
    const products1 = await Product.find({ status: "Active" })
      .select(
        "name description pimages discount isHotProduct isBestSeller isFeatured itemType variety category variants"
      )
      .populate("category", "name")
      .lean();

    // ✅ 4) Group products by category
    const productMap = {};
    products1.forEach((product) => {
      const catId = product.category?._id?.toString();
      if (!productMap[catId]) productMap[catId] = [];
      productMap[catId].push({
        id: product._id,
        name: product.name,
        desc: product.description,
        image: product.pimages?.[0],
        discount: product.discount,
        isHotProduct: product.isHotProduct,
        isBestSeller: product.isBestSeller,
        isFeatured: product.isFeatured,
        variants: product.variants.map((v) => ({
          name: v.name,
          size: v.size,
          price: v.price,
          priceAfterDiscount:
            product.discount > 0
              ? v.price - (v.price * product.discount) / 100
              : v.price,
        })),
      });
    });

    // ✅ 5) Merge categories + products
    const products = categories.map((cat) => ({
      id: cat._id,
      title: cat.name,
      description: cat.description,
      image: cat.image?.[0],
      isFeatured: cat.isFeatured,
      products: productMap[cat._id.toString()] || [],
    }));

    // ✅ 6) Save to Redis (1-hour TTL)
    try {
      await client.set(cacheKey, JSON.stringify(products), { EX: 3600 });
      console.log("💾 Catalog cached in Redis");
    } catch (cacheErr) {
      console.warn("⚠️ Redis write failed:", cacheErr.message);
    }

    // ✅ 7) Return response
    return res.json({ success: true, products, fromCache: false });
  } catch (err) {
    console.error("❌ Error fetching catalog:", err);
    res
      .status(500)
      .json({ success: false, message: "Error fetching catalog data" });
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
      description = "",
      productCode,
      variants = [],
      isFeatured = false,
      isHotProduct = false,
      isBestSeller = false,
      status = "Active",
      discount = 0,
      price,
      tags = [],
      additionalInfo = {},
      removedImages = [],
    } = req.body;

    const files = req.files; // multer adds this

    // ✅ Parse JSON strings if they come as stringified arrays
    if (typeof variants === "string") {
      try {
        variants = JSON.parse(variants);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid variants format." });
      }
    }
    if (typeof removedImages === "string") {
      try {
        removedImages = JSON.parse(removedImages);
      } catch {
        removedImages = [];
      }
    }
    if (typeof additionalInfo === "string") {
      try {
        additionalInfo = JSON.parse(additionalInfo);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid additionalInfo format." });
      }
    }

    // ✅ Validate required fields
    if (!name || !category || !brand || !description || !price) {
      return res.status(400).json({
        success: false,
        message: "Name, category, brand, description, and price are required.",
      });
    }

    // ✅ Process tags
    let tagArray = [];
    if (typeof tags === "string") {
      tagArray = tags.split(",").map((t) => t.trim());
    } else if (Array.isArray(tags)) {
      tagArray = tags;
    }

    // ✅ Validate variants
    if (!Array.isArray(variants)) {
      return res.status(400).json({
        success: false,
        message: "Variants must be an array.",
      });
    }

    // ✅ Find existing product
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // ✅ Generate slug if name changed
    let slug = existingProduct.slug;
    if (name !== existingProduct.name) {
      slug = slugify(name, { lower: true, strict: true });
    }

    // ✅ Handle new file uploads
    let newImageUrls = [];
    if (files && files.length > 0) {
      if ((existingProduct.pimages.length + files.length - removedImages.length) > 5) {
        return res.status(400).json({
          success: false,
          message: "You can have up to 5 images only.",
        });
      }
      for (const file of files) {
        try {
          const uploadResult = await cloudinary.uploader.upload(file.path, {
            folder: "product_images",
            resource_type: "image",
            transformation: [
              { width: 800, height: 800, crop: "limit" },
              { quality: "auto" },
              { fetch_format: "webp" },
            ],
          });
          newImageUrls.push(uploadResult.secure_url);
          fs.unlink(file.path, () => {}); // cleanup
        } catch (uploadErr) {
          console.error("❌ Cloudinary Upload Error:", uploadErr);
          return res.status(500).json({
            success: false,
            message: "Image upload failed. Please try again.",
          });
        }
      }
    }

    // ✅ Start with current images
    let finalImages = existingProduct.pimages || [];

    // Remove images that were flagged
    if (removedImages.length > 0) {
      finalImages = finalImages.filter((img) => !removedImages.includes(img));

      // Delete from cloudinary
      for (const imageUrl of removedImages) {
        const publicId = imageUrl.split("/").pop().split(".")[0];
        try {
          await cloudinary.uploader.destroy(`product_images/${publicId}`);
        } catch (err) {
          console.error("❌ Cloudinary Deletion Error:", err);
        }
      }
    }

    // Add new ones
    if (newImageUrls.length > 0) {
      finalImages = [...finalImages, ...newImageUrls];
    }

    // ✅ Build update object
    const updateData = {
      name,
      slug,
      category,
      subCategory,
      brand,
      description,
      productCode,
      variants,
      isFeatured,
      isHotProduct,
      isBestSeller,
      status,
      discount,
      price,
      tags: tagArray,
      additionalInfo,
      pimages: finalImages,
    };

    const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, { new: true });
    await Promise.all([clearMenuCache(), clearProductCache()]);
    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("❌ Error updating product:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while updating the product.",
    });
  }
};
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the product to get associated image URLs before deletion
    const product = await Product.findById(id).lean();

    // Check if the product exists
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // Delete images from Cloudinary if there are any
    if (product.pimages && product.pimages.length > 0) {
      for (const imageUrl of product.pimages) {
        // Regex to extract the public_id from Cloudinary URLs
        const regex = /\/upload\/(?:v\d+\/)?([^\.]+)/;
        const match = imageUrl.match(regex);

        if (match && match[1]) {
          const publicId = match[1]; // Extracted public_id
          try {
            // Deleting the image from Cloudinary using the public_id
            await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
            console.log(`Image ${publicId} deleted from Cloudinary.`);
          } catch (err) {
            console.error(`Error deleting image ${publicId} from Cloudinary:`, err);
            // Optionally, continue or decide if you want to return an error response
          }
        }
      }
    }

    // Now delete the product from the database
    await Product.findByIdAndDelete(id);
    await Promise.all([clearMenuCache(), clearProductCache()]);
    // Return a success response after deletion
    return res.json({
      success: true,
      message: "Product and associated images deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting the product. Please try again later.",
    });
  }
};


// Get products by category
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
// Get the total number of product items
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