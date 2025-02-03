import express from 'express';
import rateLimit from 'express-rate-limit';
import { forgotPassword, register, resetPassword, signIn, signInWithEmail, verifyPassword } from '../controllers/authController.js';

// ip rate limit
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const router = express.Router();

// register routes
router.post('/register', limiter, register);
router.post('/login', signIn);
router.post("/verify-password", verifyPassword);
router.post('/sign-in-with-email', signInWithEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);


export default router;
