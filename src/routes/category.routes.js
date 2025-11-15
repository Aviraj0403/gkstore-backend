// routes/category.routes.js
import express from "express";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getMainCategories,
  getCategoryDetails,
  getCategory,
  getCategoryProducts,
  getSubCategories,
  restoreCategory,
  getProductsByMainCategoryDirectSlug,
  getProductsBySubCategorySlug,
  getProductsByCategoryAndSubsSlug,
  getCategoryWithSubsBySlug
} from "../controllers/category.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { authAdmin } from "../middlewares/authAdmin.js";
import upload from '../middlewares/upload.js'; 
const router = express.Router();

// Public Routes (no authentication required)
router.get("/getAllCategories", getAllCategories); // Fetch all categories (admin view)
router.get("/getMainCategories", getMainCategories); // Fetch main categories (user view)
router.get("/getCategory/:id", getCategory); // Get single category details
router.get("/getCategoryDetails/:id", getCategoryDetails); // Get category with subcategories and products
router.get("/getCategoryProducts/:categoryId", getCategoryProducts); // Get products by category

router.use(verifyToken); // All admin routes require token verification
router.post(
  "/createCategory",
  authAdmin, // Only admin can create category
  upload.array("images", 2), // Only 2 images allowed
  createCategory
);

router.put(
  "/updateCategory/:id",
  authAdmin, // Only admin can update category
  upload.array("images", 2), // Only 2 images allowed
  updateCategory
);
router.get("/getSubCategories/:parentCategoryId", getSubCategories); 
router.delete("/deleteCategory/:id", authAdmin, deleteCategory); // Only admin can delete category
router.put("/restoreCategory/:id", authAdmin, restoreCategory);

// product fetching based on category and subcategory
router.get(
  '/categories/:slug',
  getProductsByMainCategoryDirectSlug
);
router.get(
  '/subcategories/:slug/products',
  getProductsBySubCategorySlug
);
router.get('/:slug', getCategoryWithSubsBySlug);
router.get(
  '/:slug/products',
  getProductsByCategoryAndSubsSlug
);
export default router;
