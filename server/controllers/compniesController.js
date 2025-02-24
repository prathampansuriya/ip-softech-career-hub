import mongoose from 'mongoose';
import Companies from '../models/companiesModal.js';
import Users from '../models/userModal.js';
import Jobs from '../models/jobsModal.js';
import { JobApplications } from '../models/jobApplicationModal.js';
import { Interviews } from '../models/interviewModal.js';
import { generateMockInterview } from '../utils/ai.js';
import { MockInterview } from '../models/mockInterviewModal.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Ads } from '../models/AdsModal.js';

export const register = async (req, res, next) => {
    const {
        name,
        email,
        password,
        contact,
        address,
        website,
        industry,
        numberOfEmployees,
        about,
        location,
    } = req.body;

    // Validate fields
    if (!name) {
        next("Company Name is required!");
        return;
    }
    if (!email) {
        next("Email address is required!");
        return;
    }
    if (!password || password.length < 6) {
        next("Password is required and must be greater than 6 characters");
        return;
    }
    if (!contact) {
        next("Contact number is required!");
        return;
    }
    if (!address) {
        next("Company address is required!");
        return;
    }
    if (!website) {
        next("Company website is required!");
        return;
    }
    if (!industry) {
        next("Industry is required!");
        return;
    }
    if (!numberOfEmployees) {
        next("Number of employees is required!");
        return;
    }
    if (!about) {
        next("Company description is required!");
        return;
    }
    if (!location) {
        next("Company location is required!");
        return;
    }


    try {
        const accountExist = await Companies.findOne({ email });

        if (accountExist) {
            next("Email Already Registered. Please Login");
            return;
        }

        // create a new account
        const company = await Companies.create({
            name,
            email,
            password,
            contact,
            address,
            website,
            industry,
            numberOfEmployees,
            about,
            location
        });

        // // user token
        // const token = company.createJWT();

        res.status(201).json({
            success: true,
            message: "Company Account Created Successfully",
            // user: {
            //     _id: company._id,
            //     name: company.name,
            //     email: company.email,
            // },
            // token,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

export const signIn = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        // Validation
        if (!email || !password) {
            next("Please Provide A User Credentials");
            return;
        }

        const company = await Companies.findOne({ email }).select("+password +status");

        if (!company) {
            next("Invalid email or Password");
            return;
        }

        // Check if the account is approved
        if (company.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: "Your company account is pending approval. You will be notified once approved."
            });
        }

        // Compare password
        const isMatch = await company.comparePassword(password);
        if (!isMatch) {
            next("Invalid email or Password");
            return;
        }
        company.password = undefined;

        const token = company.createJWT();

        res.status(200).json({
            success: true,
            message: "Login Successfully",
            user: company,
            _id: company._id,
            token,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};


export const updateCompanyProfile = async (req, res, next) => {
    const { name, contact, location, profileUrl, about } = req.body;

    try {
        // validation
        if (!name || !location || !about || !contact || !profileUrl) {
            next("Please Provide All Required Fields");
            return;
        }

        const id = req.body.user.userId;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(404).send(`No Company with id: ${id}`);

        const updateCompany = {
            name,
            contact,
            location,
            profileUrl,
            about,
            _id: id,
        };

        const company = await Companies.findByIdAndUpdate(id, updateCompany, {
            new: true,
        });

        const token = company.createJWT();

        company.password = undefined;

        res.status(200).json({
            success: true,
            message: "Company Profile Updated SUccessfully",
            company,
            token,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

export const getCompanyProfile = async (req, res, next) => {
    try {
        const id = req.body.user.userId;

        const company = await Companies.findById({ _id: id });

        if (!company) {
            return res.status(200).send({
                message: "Company Not Found",
                success: false,
            });
        }

        company.password = undefined;
        res.status(200).json({
            success: true,
            data: company,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

//GET ALL COMPANIES
export const getCompanies = async (req, res, next) => {
    try {
        const { search, sort, location } = req.query;

        //conditons for searching filters
        const queryObject = {};

        if (search) {
            queryObject.name = { $regex: search, $options: "i" };
        }

        if (location) {
            queryObject.location = { $regex: location, $options: "i" };
        }

        let queryResult = Companies.find(queryObject).select("-password");

        // SORTING
        if (sort === "Newest") {
            queryResult = queryResult.sort("-createdAt");
        }
        if (sort === "Oldest") {
            queryResult = queryResult.sort("createdAt");
        }
        if (sort === "A-Z") {
            queryResult = queryResult.sort("name");
        }
        if (sort === "Z-A") {
            queryResult = queryResult.sort("-name");
        }

        // PADINATIONS
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const skip = (page - 1) * limit;

        // records count
        const total = await Companies.countDocuments(queryResult);
        const numOfPage = Math.ceil(total / limit);
        // move next page
        // queryResult = queryResult.skip(skip).limit(limit);

        // show mopre instead of moving to next page
        queryResult = queryResult.limit(limit * page);

        const companies = await queryResult;

        res.status(200).json({
            success: true,
            total,
            data: companies,
            page,
            numOfPage,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

//GET  COMPANY JOBS
export const getCompanyJobListing = async (req, res, next) => {
    const { search, sort } = req.query;
    const id = req.body.user.userId;

    try {
        //conditons for searching filters
        const queryObject = {};

        if (search) {
            queryObject.location = { $regex: search, $options: "i" };
        }

        let sorting;
        //sorting || another way
        if (sort === "Newest") {
            sorting = "-createdAt";
        }
        if (sort === "Oldest") {
            sorting = "createdAt";
        }
        if (sort === "A-Z") {
            sorting = "name";
        }
        if (sort === "Z-A") {
            sorting = "-name";
        }

        let queryResult = await Companies.findById({ _id: id }).populate({
            path: "jobPosts",
            options: { sort: sorting },
        });
        const companies = await queryResult;

        res.status(200).json({
            success: true,
            companies,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

// GET SINGLE COMPANY
export const getCompanyById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const company = await Companies.findById({ _id: id }).populate({
            path: "jobPosts",
            options: {
                sort: "-_id",
            },
        });

        if (!company) {
            return res.status(200).send({
                message: "Company Not Found",
                success: false,
            });
        }

        company.password = undefined;

        res.status(200).json({
            success: true,
            data: company,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};


export const getDashboardStats = async (req, res) => {
    try {
        const companyId = req.body.user.userId; // Assuming user ID from auth middleware
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Validate year
        if (isNaN(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ status: 'error', message: 'Invalid year parameter' });
        }

        // Date range for selected year
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year + 1, 0, 1);

        // Get company's job IDs
        const companyJobs = await Jobs.find({ company: companyId }).select('_id');
        const jobIds = companyJobs.map(job => job._id);

        // Base match query for company's applications
        const applicationMatch = {
            jobId: { $in: jobIds },
            createdAt: { $gte: startDate, $lt: endDate }
        };

        // Aggregation pipelines
        const [monthlyApplicants, monthlyInterviews, statusCounts, generalStats] = await Promise.all([
            // Monthly Applicants
            JobApplications.aggregate([
                { $match: applicationMatch },
                {
                    $group: {
                        _id: { $month: "$createdAt" },
                        count: { $sum: 1 }
                    }
                },
                { $project: { month: "$_id", count: 1, _id: 0 } }
            ]),

            // Monthly Interviews (Qualified)
            JobApplications.aggregate([
                { $match: { ...applicationMatch, status: 'interviewScheduled' } },
                {
                    $group: {
                        _id: { $month: "$createdAt" },
                        count: { $sum: 1 }
                    }
                },
                { $project: { month: "$_id", count: 1, _id: 0 } }
            ]),

            // Application Status Counts
            JobApplications.aggregate([
                { $match: applicationMatch },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 }
                    }
                }
            ]),

            // General Stats
            Promise.all([
                Users.countDocuments({ createdAt: { $gte: startDate, $lt: endDate } }),
                Jobs.countDocuments({ company: companyId }),
                JobApplications.countDocuments(applicationMatch),
                Interviews.countDocuments({
                    company: companyId,
                    createdAt: { $gte: startDate, $lt: endDate }
                })
            ])
        ]);

        // Process monthly data
        const processMonthlyData = (data) => {
            const monthlyData = Array(12).fill(0);
            data.forEach(({ month, count }) => {
                monthlyData[month - 1] = count;
            });
            return monthlyData;
        };

        // Prepare status counts for pie chart
        const statusData = statusCounts.reduce((acc, { _id, count }) => {
            acc[_id] = count;
            return acc;
        }, {});

        // Aggregate monthly users count (new users per month)
        const monthlyUsers = await Users.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lt: endDate },
                },
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    count: { $sum: 1 },
                },
            },
            {
                $project: {
                    month: "$_id",
                    count: 1,
                    _id: 0,
                },
            },
        ]);

        // Process monthly user data
        const processMonthlyUserData = (data) => {
            const monthlyUserData = Array(12).fill(0); // Array with 12 months
            data.forEach(({ month, count }) => {
                monthlyUserData[month - 1] = count;
            });
            return monthlyUserData;
        };


        const mockInterviewScores = await MockInterview.aggregate([
            { $match: { createdAt: { $gte: startDate, $lt: endDate } } },
            { $unwind: "$userScores" },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    avgScore: { $avg: "$userScores.score" },
                }
            },
            { $project: { month: "$_id", avgScore: 1, _id: 0 } }
        ]);

        const processedMockScores = Array(12).fill(0);
        mockInterviewScores.forEach(({ month, avgScore }) => {
            processedMockScores[month - 1] = avgScore;
        });

        res.status(200).json({
            status: 'success',
            data: {
                totalUsers: generalStats[0],
                activeJobs: generalStats[1],
                applicants: generalStats[2],
                interviews: generalStats[3],
                graphData: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    applicants: processMonthlyData(monthlyApplicants),
                    interviews: processMonthlyData(monthlyInterviews),
                    statusDistribution: statusData,
                    userGrowth: processMonthlyUserData(monthlyUsers),
                    mockInterviewScores: processedMockScores,
                }
            }
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ status: 'error', message: 'Server Error' });
    }
};

// Assuming the 'status' field is in the JobApplications model
export const getInterviews = async (req, res) => {
    try {
        // Fetching all interviews with populated applicationId, jobId, and company details
        const interviews = await Interviews.find({})
            .populate({
                path: 'applicationId',
                select: 'status jobId applicant name',  // Populate status and jobId fields from the related JobApplications
                populate: {
                    path: 'jobId',
                    select: 'jobTitle' // Further populate jobTitle from the Job model
                }
            })
            .populate('company', 'name') // Populating the company name for each interview
            .lean(); // Convert to plain JavaScript object to avoid Mongoose-specific methods

        if (!interviews) {
            return res.status(404).json({ success: false, message: 'No interviews found.' });
        }

        res.status(200).json({ success: true, data: interviews }); // Return all interviews
    } catch (error) {
        console.error('Error fetching interviews:', error);
        res.status(500).json({ success: false, message: 'Error fetching interviews.' });
    }
};


export const createMockInterview = async (req, res) => {
    const { jobPosition, jobDesc, jobExperience, applicationId } = req.body;

    try {
        // Generate the structured interview questions with answers
        const questionAnswerPairs = await generateMockInterview(jobPosition, jobDesc, jobExperience);

        // Ensure we have questions before creating the interview
        if (!questionAnswerPairs || questionAnswerPairs.length === 0) {
            throw new Error('No questions were generated');
        }

        const mockInterview = new MockInterview({
            applicationId,
            jobPosition,
            jobDesc,
            jobExperience,
            questions: questionAnswerPairs,
        });

        await mockInterview.save();

        res.status(200).json({
            success: true,
            message: "Mock Interview created successfully",
            data: mockInterview
        });
    } catch (error) {
        console.error('Error generating interview questions:', error);
        res.status(500).json({
            success: false,
            message: "Failed to create mock interview",
            error: error.message
        });
    }
};

export const getMockInterviewsByApplicant = async (req, res) => {
    const { applicantId } = req.params;

    try {
        // Find all job applications by the current user
        const userApplications = await JobApplications.find({ applicant: applicantId });

        if (!userApplications.length) {
            return res.status(200).json({
                success: true,
                data: [],
                message: "No applications found for this user.",
            });
        }

        // Extract application IDs
        const applicationIds = userApplications.map(app => app._id);

        // Fetch all interviews related to these applications
        const interviews = await MockInterview.find({ applicationId: { $in: applicationIds } });

        res.status(200).json({
            success: true,
            data: interviews,
        });
    } catch (error) {
        console.error("Error fetching mock interviews:", error);
        res.status(500).json({ success: false, message: "Failed to fetch interviews" });
    }
};


export const getMockInterviewQuestions = async (req, res) => {
    const { interviewId } = req.params;

    try {
        const interview = await MockInterview.findById(interviewId);
        if (!interview) throw new Error("Interview not found");

        res.status(200).json({
            success: true,
            data: interview.questions,
        });
    } catch (error) {
        console.error("Error fetching interview questions:", error);
        res.status(500).json({ success: false, message: "Failed to fetch questions" });
    }
};


const genAI = new GoogleGenerativeAI(
    "AIzaSyBUAUEpaooHEJfJkOL79E18TKyWSQzH2sI"
);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const compareAnswer = async (req, res) => {
    const { question, userAnswer, generatedAnswer } = req.body;

    try {
        const prompt = `
        Compare the following:
        Question: ${question}
        User Answer: ${userAnswer}
        Generated Answer: ${generatedAnswer}

        Provide a score between 0-100 based on relevance and correctness.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const score = parseInt(response.text().match(/\d+/)[0]);

        res.status(200).json({
            success: true,
            data: { score },
        });
    } catch (error) {
        console.error("Error comparing answers:", error);
        res.status(500).json({ success: false, message: "Failed to compare answers" });
    }
};

export const saveUserScore = async (req, res) => {
    const { interviewId, question, score } = req.body;

    try {
        const interview = await MockInterview.findById(interviewId);
        if (!interview) throw new Error("Interview not found");

        interview.userScores.push({ question, score });
        await interview.save();

        res.status(200).json({
            success: true,
            message: "Score saved successfully",
        });
    } catch (error) {
        console.error("Error saving score:", error);
        res.status(500).json({ success: false, message: "Failed to save score" });
    }
};

// Controller to get attempted questions with their scores
export const getAttemptedQuestions = async (req, res) => {
    const { interviewId } = req.params;

    try {
        const interview = await MockInterview.findById(interviewId);
        if (!interview) {
            return res.status(404).json({
                success: false,
                message: "Interview not found",
            });
        }

        // Extracting the questions that have scores
        const attemptedQuestions = interview.userScores.map((scoreEntry) => ({
            question: scoreEntry.question,
            score: scoreEntry.score,
        }));

        res.status(200).json({
            success: true,
            data: attemptedQuestions,
        });
    } catch (error) {
        console.error("Error fetching attempted questions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch attempted questions",
        });
    }
};

export const analyzeInterviewQuestions = async (req, res) => {
    const { question } = req.body;

    try {
        // Fetch relevant data from MongoDB
        const applications = await JobApplications.find().populate('jobId').populate('applicant');
        const users = await Users.find();
        const jobs = await Jobs.find().populate('company');
        const companies = await Companies.find();


        const prompt = `
        You are a highly intelligent AI tasked with analyzing a question based on the provided business data. Below is the dataset and the question:

            **Company Details:**
            - Total Companies: ${companies.length}
            - Company Profiles: 
              ${companies.map(company => `
                Name: ${company.name}, 
                Industry: ${company.industry}, 
                Employees: ${company.numberOfEmployees}, 
                Website: ${company.website}, 
                Status: ${company.status}`).join('\n')}

            **Job Details:**
            - Total Jobs: ${jobs.length}
            - Job Listings:
              ${jobs.map(job => `
                Title: ${job.jobTitle}, 
                Type: ${job.jobType}, 
                Location: ${job.location}, 
                Salary: ${job.salary}, 
                Vacancies: ${job.vacancies}, 
                Posted by: ${job.company ? job.company.name : "Unknown"}`).join('\n')}

            **Application Details:**
            - Total Applications: ${applications.length}
            - Applications Summary:
              ${applications.map(app => `
                Applicant: ${app.name} (${app.email}), 
                Status: ${app.status}, 
                Job Applied For: ${app.jobId ? app.jobId.jobTitle : "Unknown"}, 
                Resume: ${app.resumeUrl || "Not Provided"}, 
                Applied On: ${app.createdAt}`).join('\n')}

            **User Details:**
            - Total Users: ${users.length}
            - Example Users:
              ${users.slice(0, 5).map(user => `
                Name: ${user.firstName} ${user.lastName}, 
                Email: ${user.email}, 
                Contact: ${user.contact}`).join('\n')}

            **Mock Interview Details:**
            - Mock Interviews Summary: ${applications
                .filter(app => app.mockInterviews)
                .map(app => `
                Application: ${app.name}, 
                Job: ${app.jobId?.jobTitle || "Unknown"}, 
                Scores: ${app.mockInterviews?.userScores.map(q => `Question: ${q.question}, Score: ${q.score}`).join(', ') || "No Scores"
                    }`).join('\n')}

            **Question:**
            "${question}"

            **Your Task:**
            - Provide an insightful and accurate response to the question based on the dataset above.
            - Ensure clarity and professionalism in your response.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.status(200).json({ text });
        console.log(text);
    } catch (error) {
        console.error('Error during AI analysis:', error.message);
        res.status(500).json({ error: `Failed to process the question: ${error.message}` });
    }

};

export const runAds = async (req, res) => {
    try {
        const { title, description, images, targetCity, details } = req.body;

        // Validate required fields
        if (!title || !description || !images || !targetCity || !details) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // Create new ad
        const newAd = new Ads({
            title,
            description,
            images,
            targetCity,
            details
        });

        await newAd.save();

        res.status(201).json({
            message: 'Advertisement created successfully',
            ad: newAd
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Advertisement could not be created' });
    }
};