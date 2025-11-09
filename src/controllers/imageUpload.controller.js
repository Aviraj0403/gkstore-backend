import cloudinary from '../config/cloudinaryConfig.js';
import fs from 'fs/promises'; // Using promise-based FS for async/await

export const uploadSingleImageToCloudinary = async (req, res, next) => {
  try {
    if (!req.file?.path) return next(); // If no file path, skip

    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: 'product_img',
      resource_type: 'image',
      transformation: [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto' },
        { fetch_format: 'webp' },
      ],
    });

    req.cloudinaryImageUrl = uploadResult.secure_url;
    req.cloudinaryPublicId = uploadResult.public_id;
    await fs.unlink(req.file.path);

    next(); // Continue to the next middleware/controller
  } catch (error) {
    console.error('❌ Cloudinary Upload Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during image upload.',
    });
  }
};
// Helper to delete images from Cloudinary by URLs
export const deleteImagesByUrlsFromCloudinary = async (imageUrls) => {
  try {
    if (!imageUrls || imageUrls.length === 0) return; // If no images to delete, skip

    for (const imageUrl of imageUrls) {
      const regex = /\/upload\/(?:v\d+\/)?([^\.]+)/;
      const match = imageUrl.match(regex);
      
      if (match && match[1]) {
        const publicId = match[1];
        
        try {
          const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
          if (result.result === 'ok') {
            console.log(`Successfully deleted image: ${publicId}`);
          } else {
            console.warn(`Failed to delete image: ${publicId}`);
          }
        } catch (err) {
          console.error("Error deleting image from Cloudinary:", err);
        }
      } else {
        console.warn(`Invalid image URL: ${imageUrl}`);
      }
    }
  } catch (error) {
    console.error("Error processing Cloudinary deletions:", error);
  }
};

export const uploadMultipleImagesToCloudinary = async (foodImages) => {
  const imageUrls = [];

  // Loop through each image file and upload to Cloudinary
  for (let i = 0; i < foodImages.length; i++) {
    const file = foodImages[i];

    try {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: 'food_images', // Folder name in Cloudinary
        resource_type: 'image', // Ensure we upload images only
        transformation: [
          { width: 800, height: 800, crop: 'limit' }, // Resize image
          { quality: 'auto' },  // Automatically optimize image quality
          { fetch_format: 'webp' },  // Convert images to WebP format
        ],
      });

      // Push the secure URL to the array
      imageUrls.push(uploadResult.secure_url);

      // Clean up the local file after upload
      await fs.unlink(file.path);
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);
      throw new Error("Cloudinary image upload failed.");
    }
  }

  return imageUrls; // Return array of image URLs
};

