const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../client/uploads/temp");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "temp-" + uniqueSuffix + ext);
  },
});

const uploadTemp = multer({
  storage: tempStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Принимаем массив файлов (поле "photos")
router.post("/api/upload/temp", uploadTemp.array("photos", 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Файлы не загружены" });
  }
  const urls = req.files.map((file) => `/uploads/temp/${file.filename}`);
  // Возвращаем в формате, который ожидает клиент
  res.json({ files: urls });
});

module.exports = router;
