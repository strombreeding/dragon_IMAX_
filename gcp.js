const { google } = require("googleapis");
const { SHEET_ID, GCP_INFO } = require("./config");
const SHEET_NAME = "cron"; // 시트 이름

const postSheet = async (
  method,
  date,
  success,
  startTime,
  endTime,
  processing
) => {
  const data = [date, success, startTime, endTime, processing];
  const auth = new google.auth.GoogleAuth({
    credentials: GCP_INFO,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  writeToSpreadsheet(client, data, method);
  return client;
};

async function writeToSpreadsheet(auth, data, method) {
  const sheets = google.sheets({ version: "v4", auth });
  const position = method === "5min" ? "A4" : "G4";
  // 쓰고자 하는 데이터
  console.log(data);
  const newData = [
    data,
    // 추가 데이터가 있다면 여기에 추가하세요.
  ];

  try {
    const response = sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!${position}`, // 시작 위치
      valueInputOption: "RAW",
      resource: {
        values: newData,
      },
    });
    console.log("Data appended successfully.");
  } catch (err) {
    console.error("Error appending data:", err);
  }
}
postSheet("5min", "0530", "TRUE", "nowTime", "", "6" + "초");
module.exports = {
  postSheet,
};
