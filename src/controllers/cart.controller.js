// controllers/cart.controller.js
import Cart from '../models/cart.model.js';
import Product from '../models/product.model.js';
import mongoose from 'mongoose';

/**
 * @desc Get current user's cart
 * @route GET /api/cart
 * @access Private
 */
export const getUserCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'items.product',
        select: 'name pimages brand slug variants discount',
      })
      .lean();

    if (!cart) {
      return res.json({
        success: true,
        cartItems: [],
        userId: req.user.id,
        updatedAt: null,
        totalPrice: 0,
      });
    }

    // Filter out invalid (deleted) products
    const validItems = cart.items.filter(item => item.product);

    const cartItems = validItems.map(item => {
      const variant = item.product.variants.find(
        v => v._id.toString() === item.selectedVariant.variantId.toString()
      );

      const priceAfterDiscount = item.product.discount > 0
        ? item.selectedVariant.price - (item.selectedVariant.price * item.product.discount / 100)
        : item.selectedVariant.price;

      return {
        productId: item.product._id,
        name: item.product.name,
        brand: item.product.brand,
        slug: item.product.slug,
        image: item.product.pimages[0],
        selectedVariant: {
          variantId: item.selectedVariant.variantId,
          size: item.selectedVariant.size,
          color: item.selectedVariant.color,
          price: item.selectedVariant.price,
          priceAfterDiscount: Number(priceAfterDiscount.toFixed(2)),
        },
        quantity: item.quantity,
      };
    });

    res.json({
      success: true,
      cartItems,
      userId: cart.user,
      updatedAt: cart.updatedAt,
      totalPrice: Number(cart.totalPrice.toFixed(2)),
    });
  } catch (error) {
    console.error('Get Cart Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get cart' });
  }
};

/**
 * @desc Add or update item in cart
 * @route POST /api/cart
 * @access Private
 */
export const addToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;

    // Validate input
    if (!productId || !variantId || !mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid productId and variantId are required.',
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1.',
      });
    }

    // Fetch product with variant
    const product = await Product.findById(productId).select('variants discount');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const variant = product.variants.find(v => v._id.toString() === variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found.' });
    }

    const priceAfterDiscount = product.discount > 0
      ? variant.price - (variant.price * product.discount / 100)
      : variant.price;

    const selectedVariant = {
      variantId: variant._id,
      size: variant.size,
      color: variant.color,
      price: variant.price,
      priceAfterDiscount: Number(priceAfterDiscount.toFixed(2)),
    };

    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
    }

    // Find existing item by product + variantId
    const itemIndex = cart.items.findIndex(
      item =>
        item.product.toString() === productId &&
        item.selectedVariant.variantId.toString() === variantId
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        selectedVariant,
        quantity,
      });
    }

    await cart.save();

    res.json({
      success: true,
      message: 'Item added to cart',
      cart,
    });
  } catch (error) {
    console.error('Add to Cart Error:', error);
    res.status(500).json({ success: false, message: 'Failed to add to cart' });
  }
};

/**
 * @desc Update item quantity in cart
 * @route PUT /api/cart/item
 * @access Private
 */
export const updateCartItem = async (req, res) => {
  try {
    const { productId, variantId, quantity } = req.body;

    if (!productId || !variantId || !mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid productId and variantId are required.',
      });
    }

    if (quantity < 0) {
      return res.status(400).json({ success: false, message: 'Quantity cannot be negative.' });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found.' });
    }

    const itemIndex = cart.items.findIndex(
      item =>
        item.product.toString() === productId &&
        item.selectedVariant.variantId.toString() === variantId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Item not found in cart.' });
    }

    if (quantity === 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();

    res.json({
      success: true,
      message: quantity === 0 ? 'Item removed' : 'Quantity updated',
      cart,
    });
  } catch (error) {
    console.error('Update Cart Item Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update cart' });
  }
};

/**
 * @desc Remove specific item from cart
 * @route DELETE /api/cart/item
 * @access Private
 */
export const removeCartItem = async (req, res) => {
  try {
    const { productId, variantId } = req.query;

    if (!productId || !variantId) {
      return res.status(400).json({
        success: false,
        message: 'productId and variantId are required.',
      });
    }

    const result = await Cart.updateOne(
      { user: req.user.id },
      {
        $pull: {
          items: {
            product: productId,
            'selectedVariant.variantId': variantId,
          },
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Item not found in cart.' });
    }

    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove Cart Item Error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove item' });
  }
};

/**
 * @desc Clear entire cart
 * @route DELETE /api/cart
 * @access Private
 */
export const clearCart = async (req, res) => {
  try {
    await Cart.updateOne(
      { user: req.user.id },
      { $set: { items: [] } }
    );

    res.json({ success: true, message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Clear Cart Error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear cart' });
  }
};