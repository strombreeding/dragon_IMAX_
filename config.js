require("dotenv").config();

const SERVER_URL = process.env.SERVER_URL || "http://localhost:8080/";
const SHEET_ID = "1F2ZYBDUUO5zJmXTZOx7ykRfUybXZiZbrSMScRxD9qmM";
const GCP_INFO = {
  type: "service_account",
  project_id: "pigeon-411401",
  private_key_id: process.env.GCP_PRIVATE_KEY_ID,
  private_key:
    "-----BEGIN PRIVATE KEY-----\n" +
    process.env.GCP_PRIVATE_KEY +
    "\n-----END PRIVATE KEY-----",
  client_email: process.env.GCP_CLIENT_EMAIL,
  client_id: process.env.GCP_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.GCP_CERT_URL,
  universe_domain: "googleapis.com",
};

module.exports = {
  SERVER_URL,
  SHEET_ID,
  GCP_INFO,
};
