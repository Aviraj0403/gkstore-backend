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
  getCategoryWithSubsBySlug,
  getMenuCategories
} from "../controllers/category.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { authAdmin } from "../middlewares/authAdmin.js";
import upload from '../middlewares/upload.js'; 
const router = express.Router();

// Public Routes (no authentication required)
router.get("/getAllCategories", verifyToken,authAdmin,getAllCategories); // Fetch all categories (admin view)
router.get("/getMainCategories", getMainCategories); // Fetch main categories (user view)
router.get("/getCategory/:id", getCategory); // Get single category details
router.get("/getCategoryDetails/:id", getCategoryDetails); // Get category with subcategories and products
router.get("/getCategoryProducts/:categoryId", getCategoryProducts); // Get products by category

router.get("/getMenuCategories", getMenuCategories);
// router.use(verifyToken); // All admin routes require token verification
router.post(
  "/createCategory", verifyToken,
  authAdmin, // Only admin can create category
  upload.array("images", 2), // Only 2 images allowed
  createCategory
);

router.put(
  "/updateCategory/:id", verifyToken,
  authAdmin, // Only admin can update category
  upload.array("images", 2), // Only 2 images allowed
  updateCategory
);
router.get("/getSubCategories/:parentCategoryId", getSubCategories); 
router.delete("/deleteCategory/:id", verifyToken , authAdmin, deleteCategory); // Only admin can delete category
router.put("/restoreCategory/:id", verifyToken , authAdmin, restoreCategory);

// product fetching based on category and subcategory
router.get(
  '/products-main/:slug',
  getProductsByMainCategoryDirectSlug // working..
);
router.get(
  '/products-sub/:slug',
  getProductsBySubCategorySlug // working..
);
router.get('/:slug', getCategoryWithSubsBySlug); // not used now
router.get(
  '/:slug/products',
  getProductsByCategoryAndSubsSlug
);
export default router;
