import express from 'express';
import { rateLimit } from "express-rate-limit";
import { analyzeInterviewQuestions, compareAnswer, createMockInterview, getAttemptedQuestions, getCompanies, getCompanyById, getCompanyJobListing, getCompanyProfile, getDashboardStats, getInterviews, getMockInterviewQuestions, getMockInterviewsByApplicant, register, runAds, saveUserScore, signIn, updateCompanyProfile } from '../controllers/compniesController.js';
import userAuth from "../middlewares/authMiddleware.js";

const router = express.Router();

//ip rate limit
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// register
router.post("/register", limiter, register);

// login
router.post("/login", limiter, signIn);


// get data
router.post("/get-company-profile", userAuth, getCompanyProfile);
router.post("/get-company-joblisting", userAuth, getCompanyJobListing);
router.get("/", getCompanies);
router.get("/get-company/:id", getCompanyById);

// UPDATE DATA
router.put("/update-company", userAuth, updateCompanyProfile);

router.get("/stats", userAuth, getDashboardStats);
router.get("/interviews", userAuth, getInterviews);

router.post("/mock-interviews/generate", createMockInterview);

// Route to fetch all mock interviews for a specific applicant
router.get("/mock-interviews/:applicantId", userAuth, getMockInterviewsByApplicant);

// Route to fetch questions for a specific mock interview
router.get("/mock-interviews/questions/:interviewId", getMockInterviewQuestions);

// Route to compare user answer with AI-generated answer
router.post("/mock-interviews/compare-answer", compareAnswer);

// Route to save the user's score for a question
router.post("/mock-interviews/save-score", saveUserScore);

// Example route in your routes file
router.get("/mock-interviews/attempted/:interviewId", getAttemptedQuestions);

router.post("/analyze", analyzeInterviewQuestions);

router.post("/run-ads", runAds);


export default router;
