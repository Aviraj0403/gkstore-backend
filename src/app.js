// src/app.js
import express from 'express';
import fs from "fs";
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import reviewRoutes from './routes/review.routes.js';
import cartRoutes from './routes/cart.routes.js';
import mapRoutes from './routes/map.routes.js';
// import orderRoutes from './routes/order.routes.js';
// import addressRoutes from './routes/address.routes.js';
// import productRoutes from './routes/product.routes.js';
// import categoryRoutes from './routes/category.routes.js';
// import wishlistRoutes from './routes/wishlist.routes.js';
// import couponRoutes from './routes/coupon.routes.js';  


// import swaggerUi from "swagger-ui-express";
// const swaggerFile = JSON.parse(fs.readFileSync(new URL("./swaggerApi/swagger-output.json", import.meta.url), "utf-8"));

import { startCronJobs } from './services/cronJobs.service.js';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set('trust proxy', 1);
// CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS not allowed"), false);
  },
  credentials: true,
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));

// Static files
app.use(express.static(join(__dirname, 'public')));
// Routes
app.use('/v1/api/auth', authRoutes);
app.use('/v1/api/users', userRoutes);
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerFile));
// Health check
app.get('/', (req, res) => {
  res.send('Hello GK-Store ! Production is running smoothly!');
});

// startCronJobs();
// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

export default app;
