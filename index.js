const puppeteer = require("puppeteer");
const { default: axios } = require("axios");

const iframSelector = "#ifrm_movie_time_table";
let firstStarted = false;
let movieData = {};

const interval = 15000;

const crawler = async (cb) => {
  //   const browser = await puppeteer.launch();
  const browser = await puppeteer.launch({
    headless: false,
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
  setInterval(async () => {
    await oneMinCrawling(page);
    // console.log(getCurrentDateTime(), "\n", JSON.stringify(movieData));
  }, interval);
};

async function oneMinCrawling(page) {
  console.log("시작한닷");
  const now = Date.now();
  try {
    for (let i = 0; i < Object.keys(movieData).length; i++) {
      await getImaxMovie(page, Object.keys(movieData)[i]);
      await sleep(150);
    }
  } catch (err) {
    console.log("[Error]: ", err.message);
  } finally {
    console.log(((now - Date.now()) * -1) / 1000, "초 걸림");
  }
}

async function getImaxMovie(page, date) {
  const showTimesSelector = "body > div > div.sect-showtimes > ul";
  const baseUrl =
    "http://www.cgv.co.kr/theaters/?areacode=01&theaterCode=0013&date=";
  await page.goto(baseUrl + date, { timeout: 60000 });
  await page.waitForSelector(iframSelector);
  const iframeHandle = await page.$(iframSelector);
  const iframe = await iframeHandle.contentFrame();

  const ul = await iframe.$(showTimesSelector);
  const imaxSchdule = await iframe.evaluate(
    (ul, movieData, date) => {
      // 필요한 함수 정의

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
        const key = movieData[date].filter(
          (obj) => obj.movieName === movieName
        );
        return key[0]["hasCinemaTypes"];
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

      // 함수정의 끝

      const resultList = [];
      const searchList = ul.children;

      // 현재 상영중인 영화를 반복문
      for (let a = 0; a < searchList.length; a++) {
        const li = searchList[a].children[0];

        const movieName = getMovieName(li);
        const schedule = [];
        const hasCinemaTypes = getCurrentCinemaTypes(date, movieName);
        console.log(movieName, movieData);
        for (let x = 1; x < li.children.length; x++) {
          const ele = li.children[x].children[0].children[0].children[0];
          const cinemaType = ele.textContent.replace(/\s/g, "").toLowerCase();
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

          console.log("여기냐", hasCinemaTypes, cinemaType);
          if (!hasCinemaTypes.includes(cinemaType)) {
            hasCinemaTypes.push(cinemaType);
            reqNotification(date, cinemaType, schedule);
          }
          console.log("잘지나갔냐");
        }
        resultList.push({
          movieName,
          schedule,
          hasCinemaTypes,
        });
      }
      return resultList;
    },
    ul,
    movieData,
    date
  );

  movieData[date] = imaxSchdule;
}
crawler();

//
async function updateDateList(page) {
  const mainPage =
    "http://www.cgv.co.kr/theaters/?areacode=01&theaterCode=0013";

  // 페이지로 이동하고 로드될 때까지 대기
  await page.goto(mainPage, { timeout: 60000 });
  await page.waitForSelector(iframSelector);
  const iframeHandle = await page.$(iframSelector);
  const iframe = await iframeHandle.contentFrame();

  const scheduleCalendar = await getScheduleList(iframe);

  //   movieData = {};

  scheduleCalendar.forEach((item) => {
    if (movieData[item] == null) movieData[item] = [];
  });

  //   await sleep(1500);
}
// 현재 용산 CGV의 상영 스케쥴 날짜를 얻는 것
async function getScheduleList(iframe) {
  const sliderElement = await iframe.$("#slider");
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
  return result;
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
