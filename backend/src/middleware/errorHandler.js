function errorHandler(error, req, res, next) {
  try {
    if (res.headersSent) {
      next(error);
      return;
    }

    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      message: error.message || 'Internal server error'
    };

    if (process.env.NODE_ENV === 'development') {
      response.stack = error.stack;
    }

    res.status(statusCode).json(response);
  } catch (handlerError) {
    next(handlerError);
  }
}

module.exports = errorHandler;
