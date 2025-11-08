// import jwt from "jsonwebtoken";
// import dotenv from "dotenv";

// dotenv.config();

// const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || process.env.JWTSECRET;
// const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || "YourRefreshTokenSecret";

// // Correct isProduction check: true when in production mode
// const isProduction = process.env.NODE_ENV === "production" ;
// console.log("isProduction:", isProduction);

// /**
//  * Generates access + refresh tokens and sets them in secure HTTP-only cookies.
//  * Automatically adjusts cookie settings for dev vs. prod.
//  */
// export async function generateToken(res, userDetails) {
//   // Access token: valid for 1 hour
//   const accessToken = jwt.sign(
//     { data: userDetails },
//     accessTokenSecret,
//     { expiresIn: "1h" }
//   );

//   // Refresh token: valid for 7 days
//   const refreshToken = jwt.sign(
//     { data: userDetails },
//     refreshTokenSecret,
//     { expiresIn: "7d" }
//   );

//   // 🔐 Cookie options (secure only in production, with path)
//   const cookieOptions = {
//     httpOnly: true,
//     secure: true, // Set to true to ensure cookies are only sent over HTTPS,
//     sameSite: "Strict",

//     path: "/",   // IMPORTANT: must include path for clearing cookie later
//     maxAge: 60 * 60 * 1000, 
//   };

//    res.cookie("accessToken", accessToken, cookieOptions);
//   res.cookie("refreshToken", refreshToken, {
//     ...cookieOptions,
//     maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days expiration for refreshToken
//   });

//   return { accessToken, refreshToken };
// }
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.JWTSECRET;

export const generateToken = async (res, userDetails) => {
  // const { id, userName, email, roleType } = userDetails;
  const token = jwt.sign(
    {
      data: userDetails,
    },
    secret,
    { expiresIn: 60 * 60 } // 1 hour expiration
  );

  res.cookie("jwt", token, {
    maxAge: 60 * 60 * 1000, // Cookie expiration time in milliseconds (1 hour)
    httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
    sameSite: "None", // Ensures cookie is sent with same-origin requests
    secure: true, // Use secure cookies in production
  });

  // You could also return the token if needed:
  return token;
};
