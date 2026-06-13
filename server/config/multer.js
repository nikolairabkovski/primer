// config/multer.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Функция для создания хранилища в заданной папке
const createStorage = (subfolder) => {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, "../../client/uploads", subfolder);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `${subfolder}-${uniqueSuffix}${ext}`);
    },
  });
};

// Общий фильтр файлов
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Только изображения разрешены"));
  }
};

// Создаём multer для разных целей
const createUploader = (subfolder) => {
  return multer({
    storage: createStorage(subfolder),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFilter,
  });
};

// Экспортируем готовые экземпляры
module.exports = {
  uploadAvatar: createUploader(""),
  uploadNewsImage: createUploader(""),
  uploadChatPhoto: createUploader("chat"),
  uploadSupportPhoto: createUploader("support"),
  uploadClubAvatar: createUploader(""), // используется тот же корень
  uploadSingle: (fieldName) => createUploader("").single(fieldName),
  uploadArray: (fieldName, maxCount) =>
    createUploader("").array(fieldName, maxCount),
};
