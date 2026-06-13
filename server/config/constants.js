// config/constants.js
module.exports = {
  PORT: process.env.PORT || 3000,
  SECRET: process.env.SECRET || "diploma_secret_key",
  UPLOAD_LIMIT: "10mb",
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
};
