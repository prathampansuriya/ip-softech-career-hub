import express from 'express';
import rateLimit from 'express-rate-limit';
import { disable2FA, enable2FA, forgotPassword, loginWithQRCode, register, resetPassword, signIn, signInWithEmail, verify2FALogin, verify2FASetup, verifyPassword } from '../controllers/authController.js';
import userAuth from '../middlewares/authMiddleware.js';

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
router.post('/sign-in-with-qr-code', loginWithQRCode);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

router.post('/enable-2fa', userAuth, enable2FA);
router.post('/verify-2fa-setup', userAuth, verify2FASetup);
router.post('/verify-2fa-login', verify2FALogin);
router.post('/disable-2fa', userAuth, disable2FA);

export default router;
