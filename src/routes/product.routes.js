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
  getMenuProduct,
  searchProducts,
  getSearchSuggestions,
  getUserProducts,
  getProduct,
  getUserProduct,
  getProductByCategory,
  getTotalProduct,
} from "../controllers/product.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { authAdmin } from "../middlewares/authAdmin.js"; // optional – create if needed
const upload = multer({ dest: "uploads/" });
const router = express.Router();

router.get("/getMenuProduct", getMenuProduct);                     // catalog (cached)
router.get("/getUserProducts", getUserProducts);                    // paginated + filters
router.get("/user/:productId", getUserProduct);          // single product (user view)
router.get("/searchProducts", searchProducts);                   // search with filters
router.get("/suggestions", getSearchSuggestions);        // autocomplete
router.get("/getProductByCategory", getProductByCategory);           // by category
router.get("/getTotalProduct", getTotalProduct);                   // total count
router.get("/getAllProduct", getAllProduct);                          // cached list (fallback)

router.use(verifyToken);                     // <-- all admin routes need auth

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
export default router;