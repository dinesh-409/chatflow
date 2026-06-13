import jwt from "jsonwebtoken";
import { sendError } from "../utils/responseHandler.js";

export const protect = (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
        return sendError(res, "Not authorized, no token", 401);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { id: userId, iat, exp }
        next();
    } catch (err) {
        console.error("[AUTH] Token verification failed:", err.message);
        return sendError(res, "Not authorized, token failed", 401);
    }
};

export const optionalProtect = (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        } catch (err) {
            // invalid token, ignore
        }
    }
    next();
};
