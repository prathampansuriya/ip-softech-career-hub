import Users from "../models/userModal.js";
import CryptoJS from "crypto-js";
import nodemailer from "nodemailer";
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import JWT from "jsonwebtoken";
import fs from 'fs';

const sendQRCodeEmail = async (email, qrCodeData) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    // Generate QR code as a buffer
    const qrCodeBuffer = await QRCode.toBuffer(qrCodeData);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Unique QR Code for Login',
        html: `<p>Here is your unique QR code for login:</p><p>Scan it to proceed.</p>`,
        attachments: [
            {
                filename: 'qrcode.png',
                content: qrCodeBuffer,
                encoding: 'base64',
            },
        ],
    };

    await transporter.sendMail(mailOptions);
};

export const register = async (req, res, next) => {
    const { firstName, lastName, email, password, faceDescriptor } = req.body;

    //validate fileds

    if (!firstName) {
        next("First Name is required");
    }
    if (!email) {
        next("Email is required");
    }
    if (!lastName) {
        next("Last Name is required");
    }
    if (!password) {
        next("Password is required");
    }
    if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
        return next("Face Descriptor is required and must be an array");
    }

    try {
        const userExist = await Users.findOne({ email });

        if (userExist) {
            next("Email Address already exists");
            return;
        }

        const user = await Users.create({
            firstName,
            lastName,
            email,
            password,
            faceDescriptor
        });

        // Generate QR code data
        const qrCodeData = JSON.stringify({ userId: user._id });

        // Send QR code to user's email
        await sendQRCodeEmail(email, qrCodeData);

        res.status(201).send({
            success: true,
            message: "Account created successfully",
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                accountType: user.accountType,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

export const signIn = async (req, res, next) => {
    const { faceDescriptor } = req.body;

    try {
        if (!faceDescriptor) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid face descriptor."
            });
        }

        const users = await Users.find().select("+faceDescriptor");

        let matchedUser = null;
        let minDistance = 0.6;

        for (const user of users) {
            if (user.faceDescriptor) {  // Add check for faceDescriptor existence
                const distance = euclideanDistance(faceDescriptor, user.faceDescriptor);
                if (distance < minDistance) {
                    minDistance = distance;
                    matchedUser = user;
                }
            }
        }

        if (matchedUser) {
            return res.status(200).json({
                success: true,
                message: "Face recognized. Please enter your password.",
                userId: matchedUser._id, // Send user ID for password verification
            });
        } else {
            return res.status(401).json({
                success: false,
                message: "Face not recognized. Please try again."
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Euclidean distance function
function euclideanDistance(descriptor1, descriptor2) {
    return Math.sqrt(
        descriptor1.reduce((sum, val, i) => sum + Math.pow(val - descriptor2[i], 2), 0)
    );
}

// controllers/authController.js
export const verifyPassword = async (req, res) => {
    const { userId, password } = req.body;

    try {
        const user = await Users.findById(userId).select("+password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid password."
            });
        }

        user.password = undefined;
        const token = user.createJWT();

        return res.status(200).json({
            success: true,
            message: "Password verified. Login successful.",
            token,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                accountType: user.accountType,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Enable 2FA and generate secret
export const enable2FA = async (req, res) => {
    const { userId } = req.body;
    console.log(userId)
    try {
        const user = await Users.findById({ _id: userId });

        const secret = speakeasy.generateSecret({
            name: `IP Softech - CareerHub (${user.email})`
        });

        user.twoFactorSecret = secret.base32;
        user.twoFactorEnabled = true;

        // Mark fields as modified to prevent unintended changes
        user.markModified('twoFactorSecret');
        user.markModified('twoFactorEnabled');

        await user.save();

        const qrCode = await QRCode.toDataURL(secret.otpauth_url);

        res.status(200).json({
            success: true,
            qrCode,
            secret: secret.base32
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error enabling 2FA' });
    }
};

// Verify 2FA setup
export const verify2FASetup = async (req, res) => {
    const { userId } = req.body;
    try {
        const { token } = req.body;
        const user = await Users.findById({ _id: userId });

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token
        });

        if (!verified) {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        }

        user.twoFactorEnabled = true;
        await user.save();

        res.status(200).json({ success: true, message: '2FA enabled successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error verifying 2FA' });
    }
};

// Disable 2FA
export const disable2FA = async (req, res) => {
    const { userId } = req.body;
    try {
        const user = await Users.findById({ _id: userId });
        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;

        // Mark fields as modified to prevent unintended changes
        user.markModified('twoFactorSecret');
        user.markModified('twoFactorEnabled');

        await user.save();

        res.status(200).json({ success: true, message: '2FA disabled successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error disabling 2FA' });
    }
};

export const signInWithEmail = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        //validation
        if (!email || !password) {
            next("Please Provide AUser Credentials");
            return;
        }

        const user = await Users.findOne({ email }).select("+password");

        if (!user) {
            next("Invalid email or Password");
            return;
        }

        //compare password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            next("Invalid email or Password");
            return;
        }
        user.password = undefined;

        if (user.twoFactorEnabled) {
            return res.status(200).json({
                success: true,
                twoFactorRequired: true,
                tempToken: JWT.sign(
                    { userId: user._id },
                    process.env.JWT_SECRET_KEY,
                    { expiresIn: '5m' }
                )
            });
        }


        const token = user.createJWT();


        res.status(200).json({
            success: true,
            message: "Login Successfully",
            user: user,
            _id: user._id,
            token,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

// Verify 2FA during login
export const verify2FALogin = async (req, res) => {
    try {
        const { token, tempToken } = req.body;

        const decoded = JWT.verify(tempToken, process.env.JWT_SECRET_KEY);
        const user = await Users.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token,
            window: 1
        });

        if (!verified) {
            return res.status(400).json({ success: false, message: 'Invalid code' });
        }

        const finalToken = user.createJWT();

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token: finalToken,
            user
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error verifying 2FA' });
    }
};

export const loginWithQRCode = async (req, res, next) => {
    const { qrCodeData } = req.body;

    try {
        const data = JSON.parse(qrCodeData);
        const user = await Users.findById(data.userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Generate JWT token
        const token = user.createJWT();

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                accountType: user.accountType,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Forgot Password
export const forgotPassword = async (req, res, next) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ message: "Please provide an email" });
        }

        const user = await Users.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate a reset token using crypto-js
        const resetToken = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);

        // Hash and store the reset token
        user.resetPasswordToken = CryptoJS.SHA256(resetToken).toString();
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // Expires in 10 minutes

        await user.save();

        // Send reset email
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        const message = `
            <html>
            <head>
                <style>
                    body {
                        font-family: 'Arial', sans-serif;
                        background-color: #f7f7f7;
                        margin: 0;
                        padding: 0;
                        color: #333;
                    }
                    .email-wrapper {
                        width: 100%;
                        background-color: #f7f7f7;
                        padding: 40px 0;
                    }
                    .email-content {
                        max-width: 600px;
                        margin: 0 auto;
                        background-color: #ffffff;
                        padding: 30px;
                        border-radius: 8px;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                        text-align: center;
                    }
                    .email-header {
                        margin-bottom: 20px;
                        font-size: 28px;
                        color: #2c3e50;
                        font-weight: bold;
                    }
                    .email-body {
                        font-size: 16px;
                        line-height: 1.5;
                        color: #555;
                        margin-bottom: 25px;
                    }
                    .cta-button {
                        background-color: #007bff;
                        color: #ffffff;
                        padding: 14px 30px;
                        font-size: 18px;
                        font-weight: bold;
                        text-decoration: none;
                        border-radius: 5px;
                        display: inline-block;
                        transition: background-color 0.3s ease;
                    }
                    .cta-button:hover {
                        background-color: #0056b3;
                    }
                    .email-footer {
                        font-size: 14px;
                        color: #777;
                        margin-top: 25px;
                    }
                    .email-footer a {
                        color: #007bff;
                        text-decoration: none;
                    }
                    .footer-links {
                        margin-top: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="email-wrapper">
                    <div class="email-content">
                        <div class="email-header">Password Reset Request</div>
                        <div class="email-body">
                            <p>Hi there,</p>
                            <p>We received a request to reset your password. If you made this request, click the button below to reset your password:</p>
                            <a href="${resetUrl}" class="cta-button" clicktracking="off">Reset Your Password</a>
                            <p>If you didn't request a password reset, please ignore this email. Your password will remain the same.</p>
                        </div>
                        <div class="email-footer">
                            <p>Thanks for using our service!</p>
                            <p class="footer-links"><a href="${process.env.FRONTEND_URL}" clicktracking="off">Visit our website</a></p>
                        </div>
                    </div>
                </div>
            </body>
        </html>
        `;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: process.env.SMTP_EMAIL,
            to: user.email,
            subject: "Password Reset Request",
            html: message,
        });

        res.status(200).json({
            success: true,
            message: "Password reset email sent",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error, please try again later" });
    }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        // Hash the received token
        const hashedToken = CryptoJS.SHA256(token).toString();

        // Find the user by the hashed token and check expiry
        const user = await Users.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        // Update password and clear reset token fields
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.status(200).json({
            success: true,
            message: "Password has been reset successfully",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error, please try again later" });
    }
};