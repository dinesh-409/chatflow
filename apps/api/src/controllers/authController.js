import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: "30d",
    });
};

export const register = async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) return sendError(res, "Email and password required", 400);

        const existingUser = await User.findOne({ email });
        if (existingUser) return sendError(res, "User already exists", 400);

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const user = await User.create({
            email,
            passwordHash,
            name: name || "New User"
        });

        const token = generateToken(user._id);
        sendSuccess(res, { token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, isGuest: user.isGuest } });
    } catch (err) {
        console.error("[AUTH] Register error", err);
        sendError(res, "Server error during registration", 500);
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return sendError(res, "Email and password required", 400);

        const user = await User.findOne({ email });
        if (!user || user.isGuest) return sendError(res, "Invalid credentials", 401);

        if (!user.passwordHash) return sendError(res, "Please login with Google", 401);

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) return sendError(res, "Invalid credentials", 401);

        const token = generateToken(user._id);
        sendSuccess(res, { token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, isGuest: user.isGuest } });
    } catch (err) {
        console.error("[AUTH] Login error", err);
        sendError(res, "Server error during login", 500);
    }
};

export const googleLogin = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) return sendError(res, "Google credential required", 400);

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        const { email, name, picture, sub: googleId } = payload;

        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                email,
                name,
                googleId,
                avatar: picture,
            });
        } else if (!user.googleId) {
            // Link google to existing email account
            user.googleId = googleId;
            if (!user.avatar) user.avatar = picture;
            await user.save();
        }

        const token = generateToken(user._id);
        sendSuccess(res, { token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, isGuest: user.isGuest } });
    } catch (err) {
        console.error("[AUTH] Google login error", err);
        sendError(res, "Invalid Google token", 401);
    }
};

export const guestLogin = async (req, res) => {
    try {
        const user = await User.create({
            isGuest: true,
            name: "Guest User"
        });

        const token = generateToken(user._id);
        sendSuccess(res, { token, user: { id: user._id, name: user.name, isGuest: user.isGuest } });
    } catch (err) {
        console.error("[AUTH] Guest login error", err);
        sendError(res, "Server error creating guest", 500);
    }
};

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-passwordHash");
        if (!user) return sendError(res, "User not found", 404);
        sendSuccess(res, { user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, isGuest: user.isGuest } });
    } catch (err) {
        sendError(res, "Server error fetching profile", 500);
    }
};
