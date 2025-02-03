import Admins from "../models/adminModal.js";
import Companies from "../models/companiesModal.js";
import { JobApplications } from "../models/jobApplicationModal.js";
import Jobs from "../models/jobsModal.js";
import Users from "../models/userModal.js";

export const signIn = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        //validation
        if (!email || !password) {
            next("Please Provide AUser Credentials");
            return;
        }

        const admin = await Admins.findOne({ email }).select("+password");

        if (!admin) {
            next("Invalid email or Password");
            return;
        }

        //compare password
        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
            next("Invalid email or Password");
            return;
        }
        admin.password = undefined;

        const token = admin.createJWT();

        res.status(200).json({
            success: true,
            message: "Login Successfully",
            user: admin,
            _id: admin._id,
            token,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

export const getAdminDashboardStats = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year + 1, 0, 1);

        const totalUsers = await Users.countDocuments();
        const pendingApplications = await Companies.countDocuments({ status: "pending" });
        const approvedCompanies = await Companies.countDocuments({ status: "approved" });
        const totalJobs = await Jobs.countDocuments();

        const graphData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            companies: await getMonthlyData(Companies, startOfYear, endOfYear),
            jobs: await getMonthlyData(Jobs, startOfYear, endOfYear),
        };

        const jobsByCompany = await Jobs.aggregate([
            { $match: { createdAt: { $gte: startOfYear, $lt: endOfYear } } },
            { $group: { _id: "$company", jobCount: { $sum: 1 } } },
            { $lookup: { from: "companies", localField: "_id", foreignField: "_id", as: "companyDetails" } },
            { $unwind: "$companyDetails" },
            { $project: { companyName: "$companyDetails.name", jobCount: 1 } },
        ]);

        const jobsByCompanyGraphData = jobsByCompany.reduce(
            (acc, curr) => {
                acc.labels.push(curr.companyName);
                acc.data.push(curr.jobCount);
                return acc;
            },
            { labels: [], data: [] }
        );

        res.status(200).json({
            status: "success",
            data: {
                totalUsers,
                pendingApplications,
                approvedCompanies,
                totalJobs,
                graphData,
                jobsByCompanyGraphData,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server Error" });
    }
};


const getMonthlyData = async (Model, startOfYear, endOfYear) => {
    const monthlyData = await Model.aggregate([
        {
            $match: {
                createdAt: { $gte: startOfYear, $lt: endOfYear },
            },
        },
        {
            $group: {
                _id: { $month: "$createdAt" },
                count: { $sum: 1 },
            },
        },
    ]);

    const monthlyCounts = new Array(12).fill(0);
    monthlyData.forEach(({ _id, count }) => {
        monthlyCounts[_id - 1] = count;
    });

    return monthlyCounts;
};

export const getPendingCompanies = async (req, res) => {
    try {
        const companies = await Companies.find({ status: 'pending' }); // Query for companies with status 'pending'
        res.status(200).json({ status: "success", data: companies });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const approveCompany = async (req, res) => {
    try {
        const { companyId } = req.body; // Get companyId from the request body

        // Update the company status to 'approved' if it's 'pending'
        const updatedCompany = await Companies.findByIdAndUpdate(
            companyId,
            { status: 'approved' }, // Update status to 'approved'
            { new: true, runValidators: true } // Return updated document and run validation
        );

        if (!updatedCompany) {
            return res.status(404).json({ status: "error", message: "Company not found" });
        }


        return res.status(200).json({ status: "success", message: "Company approved successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

