/**
 * Formats a standardized API success response
 */
export const sendSuccess = (res, data = {}, status = 200) => {
    return res.status(status).json({
        success: true,
        data,
    });
};

/**
 * Formats a standardized API error response
 */
export const sendError = (res, message = "Internal Server Error", status = 500) => {
    return res.status(status).json({
        success: false,
        error: message,
    });
};
