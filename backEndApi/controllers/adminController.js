const adminModel = require('../models/adminModel.js');
const userModel = require('../models/userModel.js');
const emailValidator = require('email-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer');
require('dotenv').config();

const { SECRET_KEY, ADMINUSER, PASS, EMAIL_FROM } = process.env;

if (!SECRET_KEY) {
    console.error('SECRET_KEY is not defined in environment variables');
    process.exit(1);
}

// Helper function to get user model based on role
const getModelByRole = (role) => {
    return role === 'admin' ? adminModel : userModel;
};

/*------------------------------------------------- SignUp --------------------------------------------------*/
const signUp = async (req, res) => {
    const { name, email, password, confirmPassword, role } = req.body;
    console.log(email, password, confirmPassword, role);

    if (!name || !email || !password || !confirmPassword) {
        return res.status(400).json({
            success: false,
            message: 'Please fill all the fields',
        });
    }

    const validEmail = emailValidator.validate(email);
    if (!validEmail) {
        return res.status(400).json({
            success: false,
            message: 'Please enter a valid email address',
        });
    }

    try {
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role || 'user';

        const model = getModelByRole(userRole);
        const newUser = new model({
            name,
            email,
            password: hashedPassword,
            role: userRole,
        });

        const result = await newUser.save();
        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: `Account already exists with provided email ${email}`,
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

/*------------------------------------------------- SignIn --------------------------------------------------*/
const comparePasswords = async (plainPassword, hashedPassword) => {
    try {
        const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
        return isMatch;
    } catch (error) {
        console.error('Error comparing passwords:', error);
        return false; // Return false in case of error or mismatch
    }
};

const signIn = async (req, res) => {
    const { email, password, role } = req.body;
    console.log(email, password);

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Every field is mandatory',
        });
    }

    // Validate email format
    if (!emailValidator.validate(email)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format',
        });
    }

    try {
        const userRole = role || 'user';
        let model;

        // Determine the model based on role
        if (userRole === 'admin') {
            model = adminModel;
        } else {
            model = getModelByRole(userRole); // Make sure to define this function in your application
        }

        const user = await model.findOne({ email });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        const hashedPassword = user.password; // Assuming user.password contains the hashed password
        const isPasswordValid = await comparePasswords(password, hashedPassword); // Await here

        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        const token = user.generateJWT();

        res.cookie('token', token, { httpOnly: true });
        return res.status(200).json({
            success: true,
            message: 'Successfully signed in',
            token,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Error during sign in:', error);
        return res.status(400).json({
            success: false,
            message: 'Invalid email or password',
        });
    }
};

/*------------------------------------------------- Forgot Password --------------------------------------------------*/

const forgotPassword = async (req, res) => {
    const { email, role } = req.body;

    if (!email) {
        return res.status(400).json({
            success: false,
            message: 'Please provide your email',
        });
    }

    if (!emailValidator.validate(email)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format',
        });
    }

    try {
        const userRole = role || 'user';
        const model = getModelByRole(userRole);
        const user = await model.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email',
            });
        }

        const generateNumericOTP = (length) => {
            let otp = '';
            for (let i = 0; i < length; i++) {
                otp += Math.floor(Math.random() * 10).toString();
            }
            return otp;
        };
        const otp = generateNumericOTP(6);

        user.resetPasswordOTP = await bcrypt.hash(otp, 10);
        user.resetPasswordOTPExpires = Date.now() + 600000; // OTP expires in 10 minutes
        await user.save();

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: ADMINUSER,
                pass: PASS,
            },
        });

        const mailOptions = {
            from: EMAIL_FROM || 'no-reply@example.com',
            to: email,
            subject: 'Password Reset OTP',
            text: `Your OTP for password reset is: ${otp}`,
        };

        transporter.sendMail(mailOptions)
            .then(info => {
                console.log('Email sent:', info.response);
                return res.status(200).json({
                    success: true,
                    message: 'OTP sent to your email',
                });
            })
            .catch(error => {
                console.error('Error sending email:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send OTP email',
                });
            });
    } catch (error) {
        console.error('Error during forgot password:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

/*------------------------------------------------- Reset Password --------------------------------------------------*/

const resetPassword = async (req, res) => {
    const { email, otp, newPassword, confirmPassword, role } = req.body;

    if (!email || !otp || !newPassword || !confirmPassword) {
        return res.status(400).json({
            success: false,
            message: 'Please provide email, OTP, new password, and confirm password',
        });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({
            success: false,
            message: 'Passwords do not match',
        });
    }

    try {
        const userRole = role || 'user';
        const model = getModelByRole(userRole);
        const user = await model.findOne({ email, resetPasswordOTPExpires: { $gt: Date.now() } });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP',
            });
        }

        if (typeof otp !== 'string' || typeof user.resetPasswordOTP !== 'string') {
            console.error('OTP and hash must be strings:', { otp, resetPasswordOTP: user.resetPasswordOTP });
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP format',
            });
        }

        const isValidOTP = await bcrypt.compare(otp, user.resetPasswordOTP);
        if (!isValidOTP) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP',
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword;
        user.resetPasswordOTP = undefined;
        user.resetPasswordOTPExpires = undefined;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Password reset successfully',
        });
    } catch (error) {
        console.error('Error during password reset:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};
/*------------------------------------------------- profileUpdate --------------------------------------------------*/

const profileUpdate = async (req, res) => {
    try {
        const { email, name, password } = req.body;
        const updateProfile = { email, name, password };

        // Assuming you have a user ID from the request (e.g., from a session or JWT)
        const userId = req.user.id; // Adjust this according to how you get the user ID

        // Validate the input (optional but recommended)
        if (!email || !name || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Find the user by ID and update the profile
        let user = await user.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Update the user fields
        user.email = updateProfile.email;
        user.name = updateProfile.name;
        user.password = updateProfile.password;

        // Save the updated user
        await user.save();

        res.status(200).json({ message: "Profile updated successfully", user });
    } catch (error) {
        res.status(500).json({ error: "An error occurred while updating the profile" });
    }
};


/*------------------------------------------------- SignOut --------------------------------------------------*/

const signOut = (req, res) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: 'No user is currently signed in',
        });
    }

    res.cookie('token', '', { maxAge: 0, httpOnly: true });
    return res.status(200).json({
        success: true,
        message: 'Successfully signed out',
    });
};

/*------------------------------------------------- Exports --------------------------------------------------*/

module.exports = {
    signUp,
    signIn,
    signOut,
    forgotPassword,
    resetPassword
};
// fixed