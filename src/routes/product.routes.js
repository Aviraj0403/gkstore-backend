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

router.get("/menu", getMenuProduct);                     // catalog (cached)
router.get("/user", getUserProducts);                    // paginated + filters
router.get("/user/:productId", getUserProduct);          // single product (user view)
router.get("/search", searchProducts);                   // search with filters
router.get("/suggestions", getSearchSuggestions);        // autocomplete
router.get("/category", getProductByCategory);           // by category
router.get("/total", getTotalProduct);                   // total count
router.get("/", getAllProduct);                          // cached list (fallback)

/* ==============================================================
   ADMIN ROUTES – require JWT + admin role
   ============================================================== */
router.use(verifyToken);                     // <-- all admin routes need auth

router.post(
  "/",
  authAdmin,                         // <-- only admin
  upload.array("images", 5),                // max 5 images
  createProduct
);

router.put(
  "/:productId",
  authAdmin,
  upload.array("images", 5),
  updateProduct
);

router.patch(
  "/:productId/images",
  authAdmin,
  upload.array("images", 5),
  updateProductImages
);

router.delete("/:id", authAdmin, deleteProduct);

router.get("/admin", authAdmin, getAdminProduct);   
router.get("/:productId", authAdmin, getProduct);  
export default router;