import mongoose from "mongoose";
import Jobs from "../models/jobsModal.js";
import Companies from '../models/companiesModal.js';
import { JobApplications } from "../models/jobApplicationModal.js";
import nodemailer from 'nodemailer';
import { Interviews } from "../models/interviewModal.js";
import { MockInterview } from "../models/mockInterviewModal.js";


export const createJob = async (req, res, next) => {
    try {

        const {
            jobTitle,
            jobType,
            location,
            salary,
            vacancies,
            experience,
            desc,
            requirements,
        } = req.body;

        if (
            !jobTitle ||
            !jobType ||
            !location ||
            !salary ||
            !requirements ||
            !desc
        ) {
            next("Please Provide All Required Fields");
            return;
        }

        const id = req.body.user.userId;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(404).send(`No Company with id: ${id}`);

        const jobPost = {
            jobTitle,
            jobType,
            location,
            salary,
            vacancies,
            experience,
            detail: { desc, requirements },
            company: id,
        };

        const job = new Jobs(jobPost);
        await job.save();

        const company = await Companies.findById(id);

        company.jobPosts.push(job._id);
        const updateCompany = await Companies.findByIdAndUpdate(id, company, {
            new: true,
        });

        res.status(200).json({
            success: true,
            message: "Job Posted SUccessfully",
            job,
        });

    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

export const updateJob = async (req, res, next) => {
    try {

        const {
            jobTitle,
            jobType,
            location,
            salary,
            vacancies,
            experience,
            desc,
            requirements,
        } = req.body;
        const { jobId } = req.params;

        if (
            !jobTitle ||
            !jobType ||
            !location ||
            !salary ||
            !desc ||
            !requirements
        ) {
            next("Please Provide All Required Fields");
            return;
        }
        const id = req.body.user.userId;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(404).send(`No Company with id: ${id}`);

        const jobPost = {
            jobTitle,
            jobType,
            location,
            salary,
            vacancies,
            experience,
            detail: { desc, requirements },
            _id: jobId
        };

        await Jobs.findByIdAndUpdate(jobId, jobPost, { new: true });

        res.status(200).json({
            success: true,
            message: "Job Post Updated SUccessfully",
            jobPost,
        });

    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

export const getJobPosts = async (req, res, next) => {
    try {

        const { search, sort, location, jtype, exp, minSalary, maxSalary } = req.query;
        const types = jtype?.split(","); //full-time,part-time
        const experience = exp?.split("-"); //2-6

        let queryObject = {};

        if (location) {
            queryObject.location = { $regex: location, $options: "i" };
        }

        if (jtype) {
            queryObject.jobType = { $in: types };
        }

        if (exp) {
            queryObject.experience = {
                $gte: Number(experience[0]) - 1,
                $lte: Number(experience[1]) + 1,
            };
        }

        if (minSalary && maxSalary) {
            queryObject.salary = {
                $gte: Number(minSalary),
                $lte: Number(maxSalary),
            };
        }

        if (search) {
            const searchQuery = {
                $or: [
                    { jobTitle: { $regex: search, $options: "i" } },
                    { jobType: { $regex: search, $options: "i" } },

                    { tags: { $regex: search, $options: 'i' } },
                ],
            };
            queryObject = { ...queryObject, ...searchQuery };
        }

        let queryResult = Jobs.find(queryObject).populate({
            path: "company",
            select: "-password",
        });

        // SORTING
        if (sort === "Newest") {
            queryResult = queryResult.sort("-createdAt");
        }
        if (sort === "Oldest") {
            queryResult = queryResult.sort("createdAt");
        }
        if (sort === "A-Z") {
            queryResult = queryResult.sort("jobTitle");
        }
        if (sort === "Z-A") {
            queryResult = queryResult.sort("-jobTitle");
        }

        // pagination
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        //records count
        const totalJobs = await Jobs.countDocuments(queryResult);
        const numOfPage = Math.ceil(totalJobs / limit);

        queryResult = queryResult.limit(limit * page);

        const jobs = await queryResult;

        res.status(200).json({
            success: true,
            totalJobs,
            data: jobs,
            page,
            numOfPage,
        });

    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
}

export const getJobById = async (req, res, next) => {
    try {

        const { id } = req.params;

        const job = await Jobs.findById({ _id: id }).populate({
            path: "company",
            select: "-password",
        });

        if (!job) {
            return res.status(200).send({
                message: "Job post not found",
                success: false,
            });
        }

        const searchQuery = {
            $or: [
                { jobTitle: { $regex: job?.jobTitle, $options: "i" } },
                { jobType: { $regex: job?.jobType, $options: "i" } },
            ],
        };

        let queryResult = Jobs.find(searchQuery).populate({
            path: "company",
            select: "-password",
        }).sort({ _id: 1 });

        queryResult = queryResult.limit(6);
        const similarJobs = await queryResult;

        res.status(200).json({
            success: true,
            data: job,
            similarJobs,
        });

    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
}

export const deleteJobPost = async (req, res, next) => {
    try {

        const { id } = req.params;

        await Jobs.findByIdAndDelete(id);

        res.status(200).send({
            success: "Job post deleted successfully"
        });

    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
}

export const applyJob = async (req, res, next) => {
    try {
        const { jobId, name, email, contact, about, resumeUrl, applicant } = req.body;

        if (!jobId || !name || !email || !resumeUrl) {
            return next("Please provide all fields");
        }


        const jobApplication = {
            jobId,
            name,
            email,
            contact,
            about,
            resumeUrl,
            applicant,
        };

        const application = new JobApplications(jobApplication);
        await application.save();

        const jobapp = await Jobs.findById(jobId);

        if (!jobapp) {
            return res.status(404).json({
                success: false,
                message: 'Job not found',
            });
        }

        jobapp.application.push(application._id);

        const updatejobapp = await Jobs.findByIdAndUpdate(jobId, jobapp, {
            new: true,
        });

        // Continue with the rest of your code


        res.status(200).json({
            success: true,
            message: "Job application submitted successfully",
            application,
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};

export const getUserJobApplications = async (req, res, next) => {
    try {
        // Fetch all job applications without filtering by applicant
        const applications = await JobApplications.find().populate({
            path: 'jobId',
            select: 'jobTitle jobType location salary',
        }).exec();

        res.status(200).json({
            success: true,
            applications,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch job applications", error: error.message });
    }
};

// Fetch all job applications (no authorization check)
export const getAllJobApplications = async (req, res) => {
    try {
        const userId = req.body.user.userId; // Assuming userId is available in req.user from authentication middleware

        // Fetch logged-in user's company ID
        const companyJobs = await Jobs.find({ company: userId }).select("_id");

        if (!companyJobs.length) {
            return res.status(404).json({ success: false, message: "No jobs found for your company." });
        }

        // Filter applications for jobs posted by the logged-in company
        const jobIds = companyJobs.map(job => job._id); // Extract job IDs
        const applications = await JobApplications.find({ jobId: { $in: jobIds } })
            .populate({
                path: "jobId",
                select: "jobTitle location salary",
            })
            .exec();

        res.status(200).json({ success: true, applications });
    } catch (error) {
        console.error("Error fetching job applications:", error);
        res.status(500).json({ success: false, message: "Failed to fetch job applications", error: error.message });
    }
};

export const getJobApplicationMockInterviews = async (req, res) => {
    try {
        const userId = req.body.user.userId;

        // First, get all jobs posted by the company
        const companyJobs = await Jobs.find({ company: userId }).select("_id");

        if (!companyJobs.length) {
            return res.status(200).json({ success: true, mockInterviews: [] });
        }

        // Get all applications for these jobs
        const jobIds = companyJobs.map(job => job._id);
        const applications = await JobApplications.find({ jobId: { $in: jobIds } }).select("_id");

        if (!applications.length) {
            return res.status(200).json({ success: true, mockInterviews: [] });
        }

        // Get mock interviews for these applications
        const applicationIds = applications.map(app => app._id);
        const mockInterviews = await MockInterview.find({
            applicationId: { $in: applicationIds }
        }).select("applicationId userScores questions");

        // Calculate percentage scores
        const scoredInterviews = mockInterviews.map(interview => {
            const totalQuestions = interview.questions.length;
            const maxPossibleScore = totalQuestions * 100; // Each question worth 100 points
            const totalScore = interview.userScores.reduce((sum, score) => sum + (score.score || 0), 0);
            const percentageScore = Math.round((totalScore / maxPossibleScore) * 100);

            return {
                applicationId: interview.applicationId,
                score: percentageScore
            };
        });

        res.status(200).json({ success: true, mockInterviews: scoredInterviews });
    } catch (error) {
        console.error("Error fetching mock interviews:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch mock interviews",
            error: error.message
        });
    }
};
// Shortlist job applications
export const shortlistJobApplications = async (req, res) => {
    try {
        // Extract selected applications from the request body
        const { selectedApplications } = req.body;

        // Update the status of selected applications to 'shortlisted'
        const updatedApplications = await JobApplications.updateMany(
            { _id: { $in: selectedApplications } },
            { $set: { status: 'shortlisted' } }
        );

        // Fetch the applications to send emails, including the applicant's email and name from JobApplications model
        const applications = await JobApplications.find({ _id: { $in: selectedApplications } })
            .populate({
                path: 'jobId',
                populate: {
                    path: 'company',
                    select: 'name',
                },
            });

        // Check if there are applications with missing applicant information
        if (!applications || applications.length === 0) {
            return res.status(404).json({ message: 'No applications found to shortlist' });
        }

        // Set up nodemailer transport
        const transporter = nodemailer.createTransport({
            service: 'gmail', // or use your email provider
            auth: {
                user: 'ipsoftechsolutions@gmail.com', // Use your own email address
                pass: 'pokprfblaryxzfby',  // Use your own email password or app password
            },
        });

        // Loop through applications to send emails
        applications.forEach(application => {
            if (application.email) { // Ensure email is available in the JobApplication model
                // Create email content
                const mailOptions = {
                    from: 'ipsoftechsolutions@gmail.com', // Sender email address
                    to: application.email, // Recipient email address from the JobApplications model
                    subject: 'Interview Shortlisted', // Subject of the email
                    html: `
                        <!DOCTYPE html>
                        <html lang="en">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Shortlisted for Interview</title>
                            <style>
                                body {
                                    font-family: Arial, sans-serif;
                                    line-height: 1.6;
                                    color: #333333;
                                    margin: 0;
                                    padding: 0;
                                    background-color: #f9f9f9;
                                }
                                .email-container {
                                    max-width: 600px;
                                    margin: 20px auto;
                                    background: #ffffff;
                                    border-radius: 8px;
                                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                                    overflow: hidden;
                                    border: 1px solid #e6e6e6;
                                }
                                .email-header {
                                    background-color: #0044cc;
                                    color: #ffffff;
                                    padding: 20px;
                                    text-align: center;
                                }
                                .email-header h1 {
                                    margin: 0;
                                    font-size: 24px;
                                }
                                .email-body {
                                    padding: 20px;
                                }
                                .email-body h2 {
                                    color: #0044cc;
                                    margin-top: 0;
                                }
                                .email-body p {
                                    margin: 10px 0;
                                }
                                .email-footer {
                                    text-align: center;
                                    padding: 10px;
                                    background: #f2f2f2;
                                    font-size: 14px;
                                    color: #666666;
                                }
                                .button {
                                    display: inline-block;
                                    background-color: #0044cc;
                                    color: #ffffff;
                                    padding: 10px 20px;
                                    text-decoration: none;
                                    border-radius: 4px;
                                    margin-top: 20px;
                                    font-size: 16px;
                                }
                                .button:hover {
                                    background-color: #0033aa;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="email-container">
                                <div class="email-header">
                                    <h1>Congratulations!</h1>
                                </div>
                                <div class="email-body">
                                    <h2>Dear ${application.name},</h2>
                                    <p>
                                        We are delighted to inform you that you have been shortlisted for an interview for the position of 
                                        <strong>${application.jobId.jobTitle}</strong> at <strong>${application.jobId.company.name}</strong>.
                                    </p>
                                    <p>
                                        This is an exciting step forward in the recruitment process, and we truly value the time and effort you put into your application.
                                    </p>
                                    <p>
                                        We will contact you shortly to schedule your interview. Please keep an eye on your email and phone for further updates.
                                    </p>
                                    <p>
                                        Should you have any questions in the meantime, feel free to reach out to us at 
                                        <a href="mailto:ipsoftechsolutions@gmail.com">ipsoftechsolutions@gmail.com</a>.
                                    </p>

                                    <p style="margin-top: 20px;">
                                        We look forward to speaking with you soon. Thank you for your interest in joining our team!
                                    </p>
                                    <p>
                                        Best regards, <br>
                                        <strong>IP Softech Solutions</strong> <br>
                                        <em>Recruitment Team</em>
                                    </p>
                                </div>
                                <div class="email-footer">
                                    &copy; 2025 IP Softech Solutions. All rights reserved.
                                </div>
                            </div>
                        </body>
                        </html>
                    `, // HTML content of the email
                };

                // Send the email
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error sending email:', error);
                    } else {
                        console.log('Email sent:', info.response);
                    }
                });
            } else {
                console.log(`Missing email for applicant with application ID: ${application._id}`);
            }
        });

        // Respond with success message
        res.status(200).json({
            success: true,
            message: 'Selected applications shortlisted successfully and emails sent.',
        });

    } catch (error) {
        console.error('Error shortlisting applications:', error);
        res.status(500).json({ message: 'Failed to shortlist applications', error: error.message });
    }
};

// Schedule interview and save data to the Interviews collection
export const scheduleInterview = async (req, res) => {
    try {
        const { applicationId, date, startTime, endTime, link, applicant, company, questions } = req.body;

        // Find the job application
        const application = await JobApplications.findById(applicationId).populate({
            path: 'jobId',
            populate: {
                path: 'company',
                select: 'name',
            },
        });

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        // Create a new interview entry
        const interview = new Interviews({
            applicationId,
            date,
            startTime,
            endTime,
            link,
            applicant,
            company,
            questions
        });

        // Save the interview to the database
        await interview.save();

        // Optionally, update the job application status to indicate interview scheduled
        application.status = 'interviewScheduled';  // You can change this based on your application's workflow
        await application.save();

        // Send email to the applicant with the interview details
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'ipsoftechsolutions@gmail.com', // Use your own email address
                pass: 'pokprfblaryxzfby',  // Use your own email password or app password
            },
        });

        const mailOptions = {
            from: 'ipsoftechsolutions@gmail.com',
            to: application.email,
            subject: 'Interview Scheduled',
            html: `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Interview Scheduled</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            background-color: #f4f4f4;
                            margin: 0;
                            padding: 0;
                            color: #333;
                        }
                        .email-container {
                            max-width: 600px;
                            margin: 30px auto;
                            background-color: #ffffff;
                            border-radius: 8px;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                            overflow: hidden;
                        }
                        .email-header {
                            background-color: #0044cc;
                            color: #ffffff;
                            padding: 20px;
                            text-align: center;
                        }
                        .email-header h1 {
                            margin: 0;
                            font-size: 24px;
                        }
                        .email-body {
                            padding: 20px;
                        }
                        .email-body h2 {
                            color: #0044cc;
                            margin-top: 0;
                        }
                        .email-body p {
                            line-height: 1.6;
                            margin: 10px 0;
                        }
                        .email-footer {
                            text-align: center;
                            font-size: 12px;
                            color: #666;
                            padding: 10px 20px;
                            background-color: #f9f9f9;
                        }
                    </style>
                </head>
                <body>
                    <div class="email-container">
                        <div class="email-header">
                            <h1>Interview Scheduled</h1>
                        </div>
                        <div class="email-body">
                            <h2>Dear ${application.name},</h2>
                            <p>
                                We are excited to inform you that your interview for the position of <strong>${application.jobId.jobTitle}</strong> at <strong>${application.jobId.company.name}</strong> has been scheduled.
                            </p>
                            <p>
                                Please find the details of your interview below:
                            </p>
                            <p><strong>Date:</strong> ${date}</p>
                            <p><strong>Start Time:</strong> ${startTime}</p>
                            <p><strong>End Time:</strong> ${endTime}</p>
                            <p>
                                <strong>Join the Interview:</strong> <a href="${link}" target="_blank" >Join Interview</a>
                            </p>
                            <p>
                                Please ensure that you have a stable internet connection and a quiet environment for the interview. If you have any issues accessing the video link or need to reschedule, feel free to contact us at 
                                <a href="mailto:ipsoftechsolutions@gmail.com">ipsoftechsolutions@gmail.com</a>.
                            </p>
                            <p>
                                We look forward to meeting you and wish you the best of luck!
                            </p>
                            <p>
                                Best regards,<br>
                                <strong>IP Softech Solutions</strong><br>
                                <em>Recruitment Team</em>
                            </p>
                        </div>
                        <div class="email-footer">
                            &copy; 2025 IP Softech Solutions. All rights reserved.
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);

        // Return success response
        res.status(200).json({ success: true, message: 'Interview scheduled and email sent' });
    } catch (error) {
        console.error('Error scheduling interview:', error);
        res.status(500).json({ message: 'Error scheduling interview' });
    }
};

export const getAllInterviews = async (req, res) => {
    try {
        const interviews = await Interviews.find({})
            .populate({
                path: 'applicationId',
                populate: { path: 'jobId', select: 'jobTitle' },
            })
            .lean();

        res.status(200).json({ success: true, data: interviews });
    } catch (error) {
        console.error('Error fetching interviews:', error);
        res.status(500).json({ success: false, message: 'Error fetching interviews.' });
    }
};

// Qualify an applicant
export const qualifyApplicant = async (req, res) => {
    try {
        const { interviewId } = req.body;

        // Update the interview status to "qualified"
        const interview = await Interviews.findByIdAndUpdate(
            interviewId,
            { status: "qualified" },
            { new: true }
        )
            .populate({
                path: 'applicationId',
                populate: {
                    path: 'jobId', // This will populate the jobId inside applicationId
                    model: 'Jobs',  // Ensure you're referencing the correct Job model
                    populate: {
                        path: 'company',  // Populate the company field within the Job model
                        model: 'Companies'
                    }
                }
            })
            .populate('company');  // Populate the company field to access the company name in the interview

        if (!interview) {
            return res.status(404).json({ success: false, message: "Interview not found." });
        }

        // Set up nodemailer
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: 'ipsoftechsolutions@gmail.com', // Use your own email address
                pass: 'pokprfblaryxzfby',  // Use your own email password or app password
            }
        });

        // HTML content with dynamic data for applicant and job
        const mailOptions = {
            from: "ipsoftechsolutions@gmail.com",
            to: interview.applicationId.email,
            subject: "Congratulations! You've been Qualified",
            html: `
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Job Offer Letter</title>
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            background-color: #f4f7fc;
                            margin: 0;
                            padding: 0;
                            color: #333;
                        }
                        .container {
                            max-width: 700px;
                            margin: 40px auto;
                            background-color: #ffffff;
                            padding: 30px;
                            border-radius: 10px;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                            border: 1px solid #e0e0e0;
                        }
                        .header {
                            text-align: center;
                            border-bottom: 2px solid #007bff;
                            padding-bottom: 20px;
                            margin-bottom: 20px;
                        }
                        .header img {
                            max-width: 100px;
                        }
                        .header h1 {
                            color: #007bff;
                            margin: 10px 0;
                        }
                        .content {
                            line-height: 1.8;
                            font-size: 16px;
                        }
                        .content h2 {
                            color: #007bff;
                            font-size: 20px;
                            margin-bottom: 10px;
                        }
                        .details-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 20px 0;
                        }
                        .details-table th, .details-table td {
                            border: 1px solid #dddddd;
                            padding: 10px 15px;
                            text-align: left;
                        }
                        .details-table th {
                            background-color: #f1f1f1;
                        }
                        .footer {
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 1px solid #dddddd;
                            text-align: center;
                            font-size: 14px;
                            color: #777777;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <img src="${interview.applicationId.jobId.company.profileUrl}" alt="Company Logo">
                            <h1>Job Offer Letter</h1>
                            <p><strong>${interview.applicationId.jobId.company.name}</strong></p>
                        </div>

                        <div class="content">
                            <p>Date: <strong>${new Date().toLocaleDateString()}</strong></p>

                            <p>Dear <strong>${interview.applicationId.name}</strong>,</p>

                            <p>We are pleased to extend a formal offer to you for the position of <strong>${interview.applicationId.jobId.jobTitle}</strong> at <strong>${interview.applicationId.jobId.company.name}.</p>

                            <p>We were thoroughly impressed by your performance during the interview process. Your qualifications, experience, and enthusiasm were remarkable, and we are confident that you will be a great asset to our team.</p>

                            <h2>Offer Details</h2>
                            <table class="details-table">
                                <tr>
                                    <th>Position</th>
                                    <td>${interview.applicationId.jobId.jobTitle}</td>
                                </tr>
                                <tr>
                                    <th>Location</th>
                                    <td>${interview.applicationId.jobId.location}</td>
                                </tr>
                                <tr>
                                    <th>Salary</th>
                                    <td>${interview.applicationId.jobId.salary}</td>
                                </tr>
                            </table>

                            <p>We look forward to welcoming you aboard and working together to achieve new heights in success.</p>

                            <p>Please feel free to reach out to us if you have any questions. Our team is here to assist you with any details regarding your offer or the next steps.</p>

                            <p>Best regards,</p>
                            <p>${interview.applicationId.jobId.company.name}</p>
                        </div>

                        <div class="footer">
                            &copy; 2025 ${interview.applicationId.jobId.company.name}. All rights reserved.
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email:", error);
                return res.status(500).json({ success: false, message: "Failed to send email." });
            }
            console.log("Email sent:", info.response);
        });

        res.status(200).json({ success: true, message: "Applicant qualified and email sent." });
    } catch (error) {
        console.error("Error qualifying applicant:", error);
        res.status(500).json({ success: false, message: "Failed to qualify applicant.", error: error.message });
    }
};

export const checkApplicationStatus = async (req, res, next) => {
    try {
        const { jobId, userId } = req.query;

        if (!jobId || !userId) {
            return res.status(400).json({
                success: false,
                message: "Job ID and User ID are required",
            });
        }

        const existingApplication = await JobApplications.findOne({
            jobId,
            applicant: userId,
        });

        if (existingApplication) {
            return res.status(200).json({
                success: true,
                applied: true,
            });
        }

        return res.status(200).json({
            success: true,
            applied: false,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Something went wrong",
        });
    }
};