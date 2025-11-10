import express from "express";
import {
  getUserCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/cart.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", getUserCart);
router.post("/", addToCart);
router.put("/item", updateCartItem);
router.delete("/item", removeCartItem);
router.delete("/", clearCart);

export default router;