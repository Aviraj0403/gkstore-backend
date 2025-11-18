// routes/product.routes.js
import express from "express";
import multer from "multer";
import {
  createProduct,
  updateProduct,
  updateProductImages,
  deleteProduct,
  getAdminProduct,
  getAllProduct,
  searchProducts,
  getSearchSuggestions,
  getUserProducts,
  getProduct,
  getUserProduct,
  getProductByCategory,
  getTotalProduct,
  getProductsByCategorySlug,
  getProductsByCategoryAndSubCategorySlug,
  getMiniProductVersion,
  getSingleProduct
} from "../controllers/product.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { authAdmin } from "../middlewares/authAdmin.js"; // optional – create if needed
import upload from '../middlewares/upload.js';
const router = express.Router();

//userprofile
router.get("/getUserProducts", getUserProducts);                    // paginated + filters
router.get("/user/:productId", getUserProduct); 

// customer side search and fetch
router.get("/searchProducts", searchProducts);                   // search with filters
router.get("/suggestions", getSearchSuggestions);        // autocomplete
router.get("/getProductByCategory", getProductByCategory);   
router.get("/getAllProduct", getAllProduct);
router.get("/getminiversion",getMiniProductVersion)    //rambaan
router.get('/getProduct/:productSlug', getSingleProduct);


// admin dashboard
router.get("/getTotalProduct", getTotalProduct);
// router.use(verifyToken);                     // <-- all admin routes need auth

router.post(
  "/createProduct",
  authAdmin,                         // <-- only admin
  upload.array("pimages", 5),                // max 5 images
  createProduct
);

router.put(
  "/updateProduct/:productId",
  authAdmin,
  upload.array("images", 5),
  updateProduct
);

router.patch(
  "/updateProductImages/:productId/images",
  authAdmin,
  upload.array("images", 5),
  updateProductImages
);

router.delete("/deleteProduct/:id", authAdmin, deleteProduct);

router.get("/getAdminProduct", authAdmin, getAdminProduct);   
router.get("/getProduct/:productId", authAdmin, getProduct);

// get product for user by slug
router.get('/:categorySlug', getProductsByCategorySlug);

// Route to get products by category and subcategory slug
router.get('/:categorySlug/:subCategorySlug', getProductsByCategoryAndSubCategorySlug);

export default router;