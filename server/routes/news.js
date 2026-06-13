const express = require("express");
const controller = require("../controllers/news");
const { verifyToken } = require("../middleware/auth");
const { uploadNewsImage } = require("../config/multer");

const router = express.Router();

router.get("/api/news/categories", controller.getCategories);
router.get("/api/news/hashtags/popular", controller.getPopularHashtags);
router.get("/api/news/authors", controller.getAuthors);

router.post(
  "/api/news",
  verifyToken,
  uploadNewsImage.single("image"),
  controller.createNews,
);

router.get("/api/news", verifyToken, controller.getNews);
router.get("/api/news/:id", controller.getById);

module.exports = router;
