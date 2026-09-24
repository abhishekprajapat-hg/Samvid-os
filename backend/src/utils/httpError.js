const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const handleControllerError = (res, error, logger, message) => {
  logger?.error({ error: error.message, message });
  return res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Server error",
  });
};

module.exports = { createHttpError, handleControllerError };
