import express from "express";
import { verifyToken } from '../middlewares/verifyToken.js';
import { clearCacheHandler, getRedisStats } from '../controllers/redis.controller.js';
const router = express.Router();


router.post("/clear-redis",  clearCacheHandler);
router.get('/stats', getRedisStats);


export default router;
