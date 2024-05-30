const puppeteer = require("puppeteer");
const { default: axios } = require("axios");
const { SERVER_URL } = require("./config");
const iframSelector = "#ifrm_movie_time_table";

// let firstStarted = false;
let allowCinemaTypes = ["imax", "4dx"];
let movieData = {};
let data = {};
const processing = {
  success: [],
  fail: [],
  date: "",
};
const interval = 20000;

const crawler = async (cb) => {
  const res = await axios.get(SERVER_URL + "crawl");
  // movieData = res.data;

  // console.log(JSON.stringify(movieData));
  // return;
  //   const browser = await puppeteer.launch();
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  /**alert 방지 */
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
  });

  await page.setViewport({
    width: 1440,
    height: 900,
  });

  // 하루에 한번씩 날짜배열 수정시킴
  await updateDateList(page);

  //   setInterval(async () => {
  //     await updateDateList(page);
  //   }, 24 * 60 * 60 * 1000);
  await oneMinCrawling(page);
};

async function oneMinCrawling(page) {
  console.log("시작한닷");
  const now = Date.now();
  processing.date = getCurrentDate;
  try {
    for (let i = 0; i < Object.keys(movieData).length; i++) {
      await getImaxMovie(page, Object.keys(movieData)[i]);
      await sleep(150);
    }
  } catch (err) {
    console.log("[oneMinCrawling:Error] ", err.message);
    if (retryOption(err)) {
      oneMinCrawling();
    } else {
      await puppeteerScreenShot("oneMinCrawling", page);
    }
  } finally {
    // console.log(JSON.stringify(movieData));
    console.log(((now - Date.now()) * -1) / 1000, "초 걸림");
  }
}

async function getImaxMovie(page, date) {
  const showTimesSelector = "body > div > div.sect-showtimes > ul";
  const baseUrl =
    "http://www.cgv.co.kr/theaters/?areacode=01&theaterCode=0013&date=";
  console.log(date, "시작");
  await page.goto(baseUrl + date, { timeout: 60000 });
  await page.waitForSelector(iframSelector);
  const iframeHandle = await page.$(iframSelector);
  const iframe = await iframeHandle.contentFrame();

  const ul = await iframe.$(showTimesSelector);
  console.log(data);
  const [setMovieData, newItem] = await iframe.evaluate(
    (ul, movieData, date, allowCinemaTypes) => {
      // --- 필요한 함수 정의 ---

      function getMovieName(li) {
        const movieName = li.children[0].children[1].children[0].textContent;
        return movieName.replace(/\s/g, "");
      }
      function getCurrentCinemaTypes(date, movieName) {
        // 한번도 안했던거면 처음 시작하는거니까 시네마타입배열은 []임
        if (movieData[date].length < 1) {
          return [];
        }
        const key = movieData[date].filter(
          (obj) => obj.movieName === movieName
        );
        return key[0]["hasCinemaTypes"];
      }

      // --- 함수정의 끝 ---

      const setMovieData = [];
      const newItem = [];
      const searchList = ul.children;

      // 현재 상영중인 영화를 반복문
      for (let a = 0; a < searchList.length; a++) {
        const li = searchList[a].children[0];
        const movieName = getMovieName(li);
        const schedule = [];

        const hasCinemaTypes = getCurrentCinemaTypes(date, movieName);
        console.log(hasCinemaTypes, "여기요@@@");
        for (let x = 1; x < li.children.length; x++) {
          const ele = li.children[x].children[0].children[0].children[1];
          const cinemaType = ele.innerText.replace(/\s/g, "").toLowerCase();
          console.log(cinemaType, allowCinemaTypes);
          // return;

          if (!allowCinemaTypes.includes(cinemaType)) continue;
          // 이 위에서 걸리므로 그냥 해도됨
          if (hasCinemaTypes.includes(cinemaType)) continue;

          const showing = [];

          // 영화의 상영타입별로 스케쥴을 정리
          const timeAndRemaining = li.children[x].children[1].children[0];
          for (let l = 0; l < timeAndRemaining.children.length; l++) {
            const ele = timeAndRemaining.children[l].children[0].textContent;
            const time = ele.replace(/\s/g, "");
            showing.push(time);
          }

          schedule.push({
            cinemaType,
            showing,
          });
          hasCinemaTypes.push(cinemaType);
          newItem.push({ date, cinemaType, schedule, movieName });
        }
        if (hasCinemaTypes.length !== 0) {
          setMovieData.push({
            movieName,
            schedule,
            hasCinemaTypes,
          });
        }
        console.log("대체 어디야");
      }
      return [setMovieData, newItem];
    },
    ul,
    movieData,
    date,
    allowCinemaTypes
  );

  if (setMovieData.length === 0) return;

  try {
    await axios.put(SERVER_URL + "crawl", {
      date,
      movieData: setMovieData,
    });
  } catch (err) {
    console.log(err.message);
  }

  if (newItem.length !== 0) {
    for (let i = 0; i < newItem.length; i++) {
      const data = newItem[i];
      const res = await axios.post(SERVER_URL + "notifications", data);
      console.log(res.data);
    }
  }

  movieData[date] = setMovieData;
}
crawler();

//
async function updateDateList(page) {
  try {
    const mainPage =
      "http://www.cgv.co.kr/theaters/?areacode=01&theaterCode=0013";
    console.log("날짜 주기 업데이트");
    await page.goto(mainPage, { timeout: 60000 });
    await page.waitForSelector(iframSelector);
    const iframeHandle = await page.$(iframSelector);
    const iframe = await iframeHandle.contentFrame();
    console.log("ㅋㅋ");

    const scheduleCalendar = await getScheduleList(iframe, page);
    //   movieData = {};
    console.log(scheduleCalendar);
    scheduleCalendar.forEach((item) => {
      if (movieData[item] == null) movieData[item] = [];
    });
    await sleep(1500);
    // 페이지로 이동하고 로드될 때까지 대기
  } catch (err) {
    console.log("[updateDateList:Error]", err.message);

    if (retryOption(err)) {
      updateDateList();
    } else {
      await puppeteerScreenShot("updateDateList", page);
    }
  }
}

// 현재 용산 CGV의 상영 스케쥴 날짜를 얻는 것
async function getScheduleList(iframe, page) {
  const sliderElement = await iframe.$("#slider");
  console.log("어디야");

  try {
    const scheduleList = await iframe.evaluate((element) => {
      const scheduleCalendar = [];
      const childNodes = element.children;
      try {
        for (let i = 0; i < childNodes.length; i++) {
          const ele = childNodes[i];
          if (ele.tagName.toLowerCase() === "div") {
            // scheduleLength = scheduleLength + ele.children.length;
            const lis = ele.children[0].children;
            for (let a = 0; a < lis.length; a++) {
              let nowYear = new Date().getFullYear();
              const li = lis[a];
              const tagA = li.children[0].children[0].children; // a 태그임 예를 클릭하면됨
              let date = "";
              for (let x = 0; x < tagA.length; x++) {
                const a = tagA[x];
                date = date + a.textContent;
              }
              const regex = /\d/g;
              const dateStr = date.match(regex).join("");
              if (dateStr === "1231") nowYear++;
              scheduleCalendar.push(nowYear.toString() + dateStr);
            }
          }
        }
      } catch (err) {
        console.log(err);
      }
      return scheduleCalendar;
    }, sliderElement);
    const result = dropPastDate(scheduleList);
    console.log(result, "이것들이 리스트");
    return result;
  } catch (err) {
    console.log("[getScheduleList:Error]", err.message);

    if (retryOption(err)) {
      await getScheduleList();
    } else {
      console.log("이거타는거 아냐 ?");
      await puppeteerScreenShot("getScheduleList", page);
    }
  }
}

// 현재 날짜 기준으로 지난 일수를 배열에서 제거후 반환
const dropPastDate = (compareList) => {
  const currentDate = getCurrentDate();
  const filteredDates = compareList.filter(
    (date) => Number(date.slice(-4)) >= Number(currentDate)
  );
  return filteredDates;
};

//현재 날짜를 MMDD 형식으로 반환
const getCurrentDate = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0"); // 월은 0부터 시작하므로 +1을 해줌
  const date = String(today.getDate()).padStart(2, "0");
  return `${month}${date}`;
};
function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, milliseconds);
  });
}

function removeEmpty(str) {
  return str.replace(/\s/g, "");
}

function getCurrentDateTime() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day} ${hours}:${minutes}:${seconds}`;
}

function getMovieName(li) {
  const movieName = li.children[0].children[1].children[0].textContent;
  return movieName.replace(/\s/g, "");
}
// 기존 시네마타입에 추가된것?
function getCurrentCinemaTypes(date, movieName) {
  // 한번도 안했던거면 처음 시작하는거니까 시네마타입배열은 []임
  if (movieData[date].length < 1) {
    return [];
  }
  const getKeyNameList = Object.keys(movieData[date]);
  const movieInfo = getKeyNameList.filter((item) => item === movieName);
  return movieInfo.currentCinemaTypes;
}

async function reqNotification(date, cinemaType, schedule) {
  console.log(`
        새 오픈 : [${date}  / ${cinemaType}] 
    `);
  const data = {
    date,
    cinemaType,
    schedule,
  };
  axios.get(`
                    API서버에선 DB를 조회하여 해당 날짜에 아이맥스를 구독중인 유저에게 노티피케이션 전송
                subcribe {
                    date: 20240508,
                    cinemaType : "아이맥스"
                    device : 디바이스id,
                }[]
                위 구독 테이블을 불러와서
                받아온 date로 검색한 후
                해당 디바이스들한테 모두 노티피케이션 해주면 됨
          `);
}

function retryOption(err) {
  let process = "";
  if (err.message.includes("Waiting failed")) {
    process++;
  }
  if (err.message.includes("ms exceeded")) {
    process++;
  }
  console.log(process);
  return process === 2 ? true : false;
}

const fs = require("fs");
async function puppeteerScreenShot(method, page) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const hour = now.getHours();
  const min = now.getMinutes();
  const time = `${year}${month}${date}${hour}${min}`;
  const directory = `screenShot/${method}/`;

  const path = `${directory}${time}.png`;
  console.log(path);

  try {
    await page.screenshot({
      path: path,
      fullPage: true,
    });
    console.log("스샷!");
  } catch (error) {
    console.error("스크린샷을 캡처하는 중에 오류가 발생했습니다:", error);
  } finally {
    process.exit(); // 작업 완료 후 프로세스 종료
  }
}
