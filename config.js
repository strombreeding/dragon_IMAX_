require("dotenv").config();

const SERVER_URL = process.env.SERVER_URL || "http://localhost:8080/";

module.exports = {
  SERVER_URL,
};
