import mongoose from "mongoose";
import Users from "../models/userModal.js";
import Resumes from "../models/resumeModel.js";
import Jobs from "../models/jobsModal.js";
import Companies from "../models/companiesModal.js";
import { JobApplications } from "../models/jobApplicationModal.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const updateUser = async (req, res, next) => {
    const {
        firstName,
        lastName,
        email,
        contact,
        location,
        profileUrl,
        jobTitle,
        about,
    } = req.body;

    try {
        if (!firstName || !lastName || !email || !contact || !jobTitle || !about) {
            next("Please provide all required fields");
        }

        const id = req.body.user.userId;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).send(`No User with id: ${id}`);
        }

        const updateUser = {
            firstName,
            lastName,
            email,
            contact,
            location,
            profileUrl,
            jobTitle,
            about,
            _id: id,
        };

        const user = await Users.findByIdAndUpdate(id, updateUser, { new: true });

        const token = user.createJWT();

        user.password = undefined;

        res.status(200).json({
            sucess: true,
            message: "User updated successfully",
            user,
            token,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

export const getUser = async (req, res, next) => {
    try {
        const id = req.body.user.userId;

        const user = await Users.findById({ _id: id });

        if (!user) {
            return res.status(200).send({
                message: "User Not Found",
                success: false,
            });
        }

        user.password = undefined;

        res.status(200).json({
            success: true,
            user: user,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "auth error",
            success: false,
            error: error.message,
        });
    }
};

const genAI = new GoogleGenerativeAI(
    "AIzaSyBUAUEpaooHEJfJkOL79E18TKyWSQzH2sI"
);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const analyzeQuestions = async (req, res) => {
    const { question, userId } = req.body;

    try {
        // Fetch relevant data from MongoDB
        const currentUser = await Users.findById(userId);
        const userResume = await Resumes.findOne({ userId });
        const applications = await JobApplications.find({ applicant: userId }).populate('jobId');
        const jobs = await Jobs.find().populate('company');
        const companies = await Companies.find();

        // Construct the prompt
        const prompt = `
        You are a highly intelligent AI tasked with analyzing a question based on the provided business data. Below is the dataset and the question:

            **Current User Details:**
            - Name: ${currentUser.firstName} ${currentUser.lastName}
            - Email: ${currentUser.email}
            - Account Type: ${currentUser.accountType}
            - Job Title: ${currentUser.jobTitle || "Not specified"}
            - About: ${currentUser.about || "Not specified"}
            - Location: ${currentUser.location || "Not specified"}
            - Profile URL: ${currentUser.profileUrl || "Not specified"}

            **Resume Details:**
            - Full Name: ${userResume?.personalDetails?.fullName || "Not specified"}
            - Email: ${userResume?.personalDetails?.email || "Not specified"}
            - Phone: ${userResume?.personalDetails?.phone || "Not specified"}
            - LinkedIn: ${userResume?.personalDetails?.linkedIn || "Not specified"}
            - Portfolio: ${userResume?.personalDetails?.portfolio || "Not specified"}
            - Objective: ${userResume?.objective || "Not specified"}
            - Experience: 
              ${userResume?.experience?.map(exp => `
                Title: ${exp.title}, 
                Company: ${exp.company}, 
                Duration: ${exp.startDate} to ${exp.endDate || "Present"}, 
                Description: ${exp.description}`).join('\n') || "No experience"}
            - Education: 
              ${userResume?.education?.map(edu => `
                Institution: ${edu.institution}, 
                Degree: ${edu.degree}, 
                Duration: ${edu.startDate} to ${edu.endDate || "Present"}, 
                Description: ${edu.description}`).join('\n') || "No education"}
            - Skills: ${userResume?.skills?.join(', ') || "No skills"}
            - Certifications: ${userResume?.certifications?.join(', ') || "No certifications"}
            - Languages: ${userResume?.languages?.join(', ') || "No languages"}

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
	
            **Question:**
            "${question}"

            **Your Task:**
            - Provide an insightful and accurate response to the question based on the dataset above.
            - Ensure clarity and professionalism in your response.
            - If the question is related to job suggestions, provide personalized recommendations based on the user's resume and profile.
            - If the question is about the status of applications, provide a detailed summary of the user's applications.
            - If the question is about company details, provide relevant information about the companies.
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