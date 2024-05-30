function getCurrentDate(full) {
  const justMonth = full == null ? true : false;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  if (justMonth) {
    return `${month}${day}`;
  } else {
    return `${year}${month}${day}`;
  }
}

const getCurrentDateTime = () => {
  const now = new Date();

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
};

// 현재 날짜 기준으로 지난 일수를 배열에서 제거후 반환
const dropPastDate = (compareList) => {
  const currentDate = getCurrentDate();
  console.log(currentDate);
  const filteredDates = compareList.filter(
    (date) => Number(date.slice(-4)) >= Number(currentDate)
  );
  return filteredDates;
};

const removeEmpty = (str) => {
  return str.replace(/\s/g, "");
};

// 에러시 재시도
const retryOption = (err) => {
  let process = "";
  if (err.message.includes("Waiting failed")) {
    process++;
  }
  if (err.message.includes("ms exceeded")) {
    process++;
  }
  console.log(process);
  return process === 2 ? true : false;
};

module.exports = {
  getCurrentDate,
  getCurrentDateTime,
  dropPastDate,
  removeEmpty,
  retryOption,
};

//
// */5 * * * * /home/ubuntu/dragon_IMAX_/5min.sh

// 0 0 * * * /home/ubuntu/dragon_IMAX_/1day.sh
