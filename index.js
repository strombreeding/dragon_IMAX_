const puppeteer = require("puppeteer");
const { default: axios } = require("axios");
const { SERVER_URL } = require("./config");
const iframSelector = "#ifrm_movie_time_table";
const {
  dropPastDate,
  retryOption,
  getCurrentDate,
  getCurrentDateTime,
} = require("./utils");
const { postSheet } = require("./gcp");
const { sendSlackBot } = require("./slack");
// let firstStarted = false;
let allowCinemaTypes = ["imax", "4dx"];
let movieData = {};
let data = {};

const crawler = async (cb) => {
  console.log(getCurrentDate(true), getCurrentDateTime(), "작업 시작");
  const res = await axios.get(SERVER_URL + "crawl");
  movieData = res.data;
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

  await updateDateList(page);

  await oneMinCrawling(page);
  browser.close();
  return;
};

async function oneMinCrawling(page) {
  const now = Date.now();
  const dateString = getCurrentDate(true);
  const nowTime = getCurrentDateTime();
  let success = false;
  try {
    for (let i = 0; i < Object.keys(movieData).length; i++) {
      await getImaxMovie(page, Object.keys(movieData)[i]);
      await sleep(150);
    }
    success = true;
  } catch (err) {
    console.log("[oneMinCrawling:Error] ", err.message);
    if (retryOption(err)) {
      oneMinCrawling();
    } else {
      sendSlackBot("[oneMinCrawling]:에러발생");
      await puppeteerScreenShot("oneMinCrawling", page);
    }
  } finally {
    console.log(((now - Date.now()) * -1) / 1000, "초 걸림");
    postSheet(
      "5min",
      dateString,
      success.toString().toUpperCase(),
      nowTime,
      getCurrentDateTime(),
      (((now - Date.now()) * -1) / 1000).toString() + "초"
    );
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
  const [setMovieData, newItem] = await iframe.evaluate(
    (ul, movieData, date, allowCinemaTypes) => {
      // --- 필요한 함수 정의 ---

      const getMovieName = (li) => {
        const movieName = li.children[0].children[1].children[0].textContent;
        return movieName.replace(/\s/g, "");
      };
      const getCurrentCinemaTypes = (date, movieName) => {
        // 한번도 안했던거면 처음 시작하는거니까 시네마타입배열은 []임
        if (movieData[date].length < 1) {
          return [];
        }
        const key = movieData[date].filter(
          (obj) => obj.movieName === movieName
        );
        if (key.length === 0) {
          return [];
        }
        return key[0]["hasCinemaTypes"];
      };

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
        const currentCinemaTypeLength = hasCinemaTypes.length;

        for (let x = 1; x < li.children.length; x++) {
          const ele = li.children[x].children[0].children[0].children[1];
          const cinemaType = ele.innerText.replace(/\s/g, "").toLowerCase();
          // return;

          if (!allowCinemaTypes.includes(cinemaType)) continue;
          //
          if (hasCinemaTypes.includes(cinemaType)) continue;
          // throw new Error(
          //   `${hasCinemaTypes.includes(
          //     cinemaType
          //   )}/${movieName}/${hasCinemaTypes}`
          // );
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
        if (hasCinemaTypes.length > currentCinemaTypeLength) {
          // if (movieData[date].length === 0) {
          //   movieData[date].push({
          //     movieName,
          //     schedule: [],
          //     hasCinemaTypes,
          //   });
          // }
          const exist = movieData[date].find(
            (item) => item.movieName === movieName
          );

          const setData = movieData[date].map((item) => {
            if (item.movieName === movieName) {
              item.schedule = [...item.schedule, ...schedule];
            }
            return item;
          });

          if (setData.length === 0 || !exist) {
            setData.push({
              movieName,
              schedule,
              hasCinemaTypes,
            });
          }
          setMovieData.push(...setData);
        }
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
      try {
        const res = await axios.post(SERVER_URL + "notifications", data);
      } catch (err) {
      } finally {
      }
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
    await page.goto(mainPage, { timeout: 60000 });
    await page.waitForSelector(iframSelector);
    const iframeHandle = await page.$(iframSelector);
    const iframe = await iframeHandle.contentFrame();

    const scheduleCalendar = await getScheduleList(iframe, page);
    //   movieData = {};
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
      sendSlackBot("[updateDateList]:에러발생");
      await puppeteerScreenShot("updateDateList", page);
    }
  }
}

// 현재 용산 CGV의 상영 스케쥴 날짜를 얻는 것
async function getScheduleList(iframe, page) {
  const sliderElement = await iframe.$("#slider");

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
    return result;
  } catch (err) {
    console.log("[getScheduleList:Error]", err.message);

    if (retryOption(err)) {
      await getScheduleList();
    } else {
      sendSlackBot("[getScheduleList]:에러발생");
      await puppeteerScreenShot("getScheduleList", page);
    }
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, milliseconds);
  });
}

async function reqNotification(date, cinemaType, schedule) {
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

async function puppeteerScreenShot(method, page) {
  const time = `${getCurrentDate()}${getCurrentDateTime()}`;
  const directory = `screenShot/${method}/`;
  const path = `${directory}${time}.png`;

  try {
    await page.screenshot({
      path: path,
      fullPage: true,
    });
  } catch (error) {
    console.error("스크린샷을 캡처하는 중에 오류가 발생했습니다:", error);
  } finally {
    process.exit(); // 작업 완료 후 프로세스 종료
  }
}
