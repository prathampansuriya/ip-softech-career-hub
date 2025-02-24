import express from 'express';
import { rateLimit } from "express-rate-limit";
import { approveCompany, getAdminDashboardStats, getPendingCompanies, signIn } from '../controllers/adminController.js';
import userAuth from '../middlewares/authMiddleware.js';

const router = express.Router();

//ip rate limit
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});



// login
router.post("/login", limiter, signIn);

router.get("/stats", userAuth, getAdminDashboardStats);

// Route to get companies with 'pending' status
router.get('/companies-application', getPendingCompanies);  // Fetch pending companies

// Route to approve a company
router.post('/approve', approveCompany);  // Approve a company



export default router;
