// server.js
const app = require("./app");
const { PORT } = require("./config/constants");

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});

process.on("uncaughtException", (err) => {
  console.error("Необработанное исключение:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Необработанное отклонение промиса:", err);
});
