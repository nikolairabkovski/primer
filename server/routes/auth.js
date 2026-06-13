// routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { SECRET } = require("../config/constants");

const router = express.Router();

router.post("/api/register", async (req, res) => {
  try {
    const { fullname, nickname, username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Заполните обязательные поля" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (fullname, nickname, username, email, password, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullname || "", nickname || "", username, email, hashedPassword, "user"],
      function (err) {
        if (err) {
          console.error("Ошибка регистрации:", err.message);
          if (err.message.includes("UNIQUE")) {
            return res.status(400).json({
              message: "Пользователь с таким email или username уже существует",
            });
          }
          return res
            .status(500)
            .json({ message: "Ошибка сервера при регистрации" });
        }
        res.json({ message: "Регистрация успешна", id: this.lastID });
      },
    );
  } catch (error) {
    console.error("Ошибка регистрации:", error);
    res.status(500).json({ message: "Внутренняя ошибка сервера" });
  }
});

router.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Введите email и пароль" });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err) {
      console.error("Ошибка авторизации:", err.message);
      return res.status(500).json({ message: "Ошибка сервера" });
    }

    if (!user) {
      return res.status(401).json({ message: "Неверная почта или пароль" });
    }

    try {
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(401).json({ message: "Неверная почта или пароль" });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        SECRET,
        { expiresIn: "24h" },
      );

      res.json({
        message: "Вход выполнен",
        token: token,
        user: {
          id: user.id,
          fullname: user.fullname,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Ошибка сравнения паролей:", error);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  });
});

module.exports = router;
