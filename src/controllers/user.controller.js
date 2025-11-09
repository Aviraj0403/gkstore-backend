import users from "../models/user.model.js";
import mongoose from "mongoose";
import { verifyToken } from '../middlewares/verifyToken.js';

// Helper function to validate location
export const validateLocation = (location) => {
  if (!location || typeof location !== 'object' || location.type !== 'Point' || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    return false;
  }
  const [lng, lat] = location.coordinates;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

// Add address function
export const addAddress = async (req, res) => {
  try {
    const user = await users.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Validate required fields
    if (!req.body.phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // If location is not provided, set default (0, 0)
    const location = req.body.location || { type: "Point", coordinates: [0, 0] };

    // Validate coordinates, ensure they're not [0, 0]
    if (location.coordinates[0] === 0 && location.coordinates[1] === 0) {
      return res.status(400).json({ message: "Invalid location: Coordinates cannot be [0, 0]" });
    }

    // Validate location structure
    if (!validateLocation(location)) {
      return res.status(400).json({ message: "Invalid location: must be { type: 'Point', coordinates: [longitude, latitude] }" });
    }

    // Create new address object from request body
    const newAddress = {
      id: new mongoose.Types.ObjectId(),
      name: req.body.name || user.userName,
      phoneNumber: req.body.phoneNumber,
      street: req.body.street,
      city: req.body.city,
      state: req.body.state,
      country: req.body.country || 'India',
      postalCode: req.body.pincode || req.body.postalCode,
      label: req.body.type || 'Home',
      location,
      isDefault: user.addresses.length === 0,
    };

    // Validate required fields for address
    if (!newAddress.street || !newAddress.city || !newAddress.state || !newAddress.postalCode) {
      return res.status(400).json({ message: "Street, city, state, and postal code are required" });
    }

    // Push the new address to user's address list and save
    user.addresses.push(newAddress);
    await user.save();

    // Respond with the updated address list
    res.status(201).json({
      message: "Address added successfully",
      addresses: user.addresses.map(addr => ({
        id: addr.id,
        label: addr.label,
        name: addr.name,
        phoneNumber: addr.phoneNumber,
        street: addr.street,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
        isDefault: addr.isDefault,
        location: addr.location,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add address", error: err.message });
  }
};



// Update Address
export const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await users.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const addressIndex = user.addresses.findIndex((addr) => addr.id.toString() === id);
    if (addressIndex === -1) return res.status(404).json({ message: "Address not found" });

    const location = req.body.location || user.addresses[addressIndex].location;
    if (!validateLocation(location)) {
      return res.status(400).json({ message: "Invalid location: must be { type: 'Point', coordinates: [longitude, latitude] }" });
    }

    user.addresses[addressIndex] = {
      ...user.addresses[addressIndex],
      name: req.body.name || user.addresses[addressIndex].name,
      phoneNumber: req.body.phoneNumber || user.addresses[addressIndex].phoneNumber,
      street: req.body.street || user.addresses[addressIndex].street,
      city: req.body.city || user.addresses[addressIndex].city,
      state: req.body.state || user.addresses[addressIndex].state,
      postalCode: req.body.postalCode || user.addresses[addressIndex].postalCode,
      country: req.body.country || user.addresses[addressIndex].country,
      label: req.body.label || user.addresses[addressIndex].label,
      location,
    };

    // Validate required fields
    if (!user.addresses[addressIndex].street || !user.addresses[addressIndex].city || !user.addresses[addressIndex].state || !user.addresses[addressIndex].postalCode) {
      return res.status(400).json({ message: "Street, city, state, and postal code are required" });
    }

    await user.save();
    res.status(200).json({
      message: "Address updated",
      addresses: user.addresses.map(addr => ({
        id: addr.id,
        label: addr.label,
        name: addr.name,
        phoneNumber: addr.phoneNumber,
        street: addr.street,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
        isDefault: addr.isDefault,
        location: addr.location,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to update address", error: err.message });
  }
};

// Delete Address
export const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await users.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const addressIndex = user.addresses.findIndex((addr) => addr.id.toString() === id);
    if (addressIndex === -1) return res.status(404).json({ message: "Address not found" });

    user.addresses.splice(addressIndex, 1);

    if (!user.addresses.some(addr => addr.isDefault) && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    res.status(200).json({
      message: "Address deleted",
      addresses: user.addresses.map(addr => ({
        id: addr.id,
        label: addr.label,
        name: addr.name,
        phoneNumber: addr.phoneNumber,
        street: addr.street,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
        isDefault: addr.isDefault,
        location: addr.location,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete address", error: err.message });
  }
};

// Set Default Address
export const setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await users.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const address = user.addresses.find((addr) => addr.id.toString() === id);
    if (!address) return res.status(404).json({ message: "Address not found" });

    user.addresses.forEach((addr) => {
      addr.isDefault = addr.id.toString() === id;
    });

    await user.save();
    res.status(200).json({
      message: "Default address set",
      addresses: user.addresses.map(addr => ({
        id: addr.id,
        label: addr.label,
        name: addr.name,
        phoneNumber: addr.phoneNumber,
        street: addr.street,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
        isDefault: addr.isDefault,
        location: addr.location,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to set default address", error: err.message });
  }
};

// Get User Addresses
export const getUserAddresses = async (req, res) => {
  try {
    // console.log("Fetching addresses for user:", req.user.id);
    const user = await users.findById(req.user.id).select("addresses");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      message: "Addresses retrieved successfully",
      data: user.addresses.map(addr => ({
        id: addr.id,
        label: addr.label,
        name: addr.name,
        phoneNumber: addr.phoneNumber,
        street: addr.street,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
        isDefault: addr.isDefault,
        location: addr.location,
      })),
    });
  } catch (error) {
    console.error("Failed to get addresses:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getTotalUsers = async (req, res) => {
  try {
    const total = await users.countDocuments();

    res.status(200).json({
      success: true,
      totalUsers: total,
    });
  } catch (error) {
    console.error("Error fetching total users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch total users.",
      error: error.message,
    });
  }
};









// Helper function to fetch users by role without pagination
export const getUsersByRoleHelper = async (roleType) => {
  return await users.find({ roleType }).select('-password');
};

// Fetch all customers
export const getAllCustomers = async (req, res) => {
  try {
    const users = await getUsersByRoleHelper('customer');
    return res.status(200).json({
      success: true,
      message: 'Customers fetched successfully',
      data: users,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
    });
  }
};

// Fetch all admins
export const getAllAdmins = async (req, res) => {
  try {
    const users = await getUsersByRoleHelper('admin');
    return res.status(200).json({
      success: true,
      message: 'Admins fetched successfully',
      data: users,
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admins',
    });
  }
};

// Fetch all delivery boys
export const getAllDeliveryBoys = async (req, res) => {
  try {
    const users = await getUsersByRoleHelper('deliveryBoy');
    return res.status(200).json({
      success: true,
      message: 'Delivery boys fetched successfully',
      data: users,
    });
  } catch (error) {
    console.error('Error fetching delivery boys:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery boys',
    });
  }
};

// Fetch all regular users
export const getAllUsers = async (req, res) => {
  try {
    const users = await getUsersByRoleHelper('user');
    return res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    });
  }
};

export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await users.findById(userId).select("-password"); // Select all except the password
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};







