// controllers/cart.controller.js
import Cart from '../models/cart.model.js';
import Product from '../models/product.model.js';

/**
 * @desc Get current user's cart
 * @route GET /api/cart
 * @access Private
 */
export const getUserCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'name slug pimages discount')
      .lean();

    if (!cart || cart.items.length === 0) {
      return res.json({
        success: true,
        cartItems: [],
        totalPrice: 0,
      });
    }

    const cartItems = cart.items.map(item => {
      const price = item.selectedVariant.price;
      const discount = item.product.discount || 0;
      // const finalPrice = price + (price * discount / 100); // +discount%

      return {
        productId: item.product._id,
        name: item.product.name,
        // slug: item.product.slug,
        image: item.product.pimages[0],
        size: item.selectedVariant.size,
        price: price,
        discount: discount,
        // priceAfterDiscount: Number(finalPrice.toFixed(2)),
        quantity: item.quantity,
        subtotal: Number((price * item.quantity).toFixed(2)),
      };
    });

    const totalPrice = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

    res.json({
      success: true,
      cartItems,
      totalPrice: Number(totalPrice.toFixed(2)),
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
    const { productId, size, quantity = 1 } = req.body;

    if (!productId || !size) {
      return res.status(400).json({ success: false, message: 'productId and size are required' });
    }

    const product = await Product.findById(productId).select('variants discount stockQty');
    console.log('Product fetched for cart:', product);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const variant = product.variants.find(v => v.size.trim() === size.trim());
    if (!variant) return res.status(400).json({ success: false, message: 'Size not found' });

    if (variant.stockQty < quantity) {
      return res.status(400).json({ success: false, message: 'Out of stock' });
    }

    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(item =>
      item.product.toString() === productId &&
      item.selectedVariant.size.trim() === size.trim()
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        selectedVariant: {
          size: variant.size,
          price: variant.price,
          stockQty: variant.stockQty,
          packaging: variant.packaging || 'N/A'
        },
        quantity
      });
    }

    await cart.save();

    res.json({
      success: true,
      message: 'Added to cart successfully',
    });

  } catch (error) {
    console.error('Add to Cart Error:', error);
    res.status(500).json({ success: false, message: 'Failed to add item' });
  }
};

/**
 * @desc Update item quantity in cart
 * @route PUT /api/cart/:productId/:size
 * @access Private
 */
export const updateCartItem = async (req, res) => {
  try {
    const { productId, size } = req.body;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Valid quantity required' });
    }

    const result = await Cart.updateOne(
      {
        user: req.user.id,
        'items.product': productId,
        'items.selectedVariant.size': size
      },
      { $set: { 'items.$.quantity': quantity } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    res.json({ success: true, message: 'Quantity updated' });

  } catch (error) {
    console.error('Update Cart Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

/**
 * @desc Remove specific item from cart
 * @route DELETE /api/cart/:productId/:size
 * @access Private
 */
export const removeCartItem = async (req, res) => {
  try {
    // Use query parameters for productId and size
    const { productId, size } = req.query;
    // console.log('Removing item from cart:', productId, size);

    const result = await Cart.updateOne(
      { user: req.user.id },
      {
        $pull: {
          items: {
            product: productId,
            'selectedVariant.size': size, // Ensure you're correctly matching the size
          },
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove Cart Error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove' });
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