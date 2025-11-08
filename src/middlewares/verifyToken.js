import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const secret = process.env.JWTSECRET;

// Export the verifyToken function using the 'export const' pattern
export const verifyToken = (req, res, next) => {
  // console.log("Token work");

  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({
      message: "Access Denied! Token Broken or Expired",
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (!decoded.data) {
      return res.status(401).json({
        message: "User data not available",
      });
    }

    const { id, userName, email, roleType } = decoded.data;
    req.user = { id, userName, email, roleType };

    console.log("user token", req.user);
    next();
  } catch (error) {
    return res.status(400).json({
      message: "Invalid Token",
      error: error.message,
    });
  }
};

// Middleware to verify Firebase ID token if you want to use it in some routes
export const verifyFirebaseToken = async (req, res, next) => {
  const firebaseToken = req.headers['authorization']?.split(' ')[1];

  if (!firebaseToken) {
    return res.status(401).json({
      message: 'Firebase Token Missing',
    });
  }

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    req.firebaseUser = decodedToken;  // Attach decoded Firebase user to request object
    next();
  } catch (error) {
    return res.status(400).json({
      message: 'Invalid Firebase Token',
      error: error.message,
    });
  }
};