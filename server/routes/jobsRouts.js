import express from 'express';
import userAuth from "../middlewares/authMiddleware.js";
import { applyJob, checkApplicationStatus, createJob, deleteJobPost, getAllInterviews, getAllJobApplications, getJobApplicationMockInterviews, getJobById, getJobPosts, getUserJobApplications, qualifyApplicant, scheduleInterview, shortlistJobApplications, updateJob } from '../controllers/jobController.js';



const router = express.Router();

router.post("/upload-job", userAuth, createJob);
router.put("/update-job/:jobId", userAuth, updateJob);

router.get("/find-jobs", getJobPosts);
router.get("/get-job-detail/:id", getJobById);

router.delete("/delete-job/:id", userAuth, deleteJobPost);

router.post("/apply-job", userAuth, applyJob);

router.get("/get-user-job-applications", userAuth, getUserJobApplications);

// Route to get all job applications without authorization
router.get('/get-all-job-applications', userAuth, getAllJobApplications);

router.get('/get-all-job-applications-mock-interview', userAuth, getJobApplicationMockInterviews);

router.post('/shortlist-job-applications', shortlistJobApplications);

router.post('/schedule-interview', scheduleInterview);

router.get('/interview', getAllInterviews);

router.post('/qualify-applicant', qualifyApplicant);

router.get("/check-application-status", userAuth, checkApplicationStatus);

export default router;
