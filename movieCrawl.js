const puppeteer = require("puppeteer");
const { default: axios } = require("axios");
const { SERVER_URL } = require("./config");

const movieCrawl = async () => {
  const browser = await puppeteer.launch({
    headless: true,
  });

  const page = await browser.newPage();

  /**alert 방지 */
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
  });

  // await page.setViewport({
  //   width: 1440,
  //   height: 900,
  // });

  const imaxPage =
    "http://www.cgv.co.kr/theaters/special/defaultDetailNew.aspx?regioncode=07&submenu=";
  const forDXPage =
    "http://www.cgv.co.kr/theaters/special/defaultDetailNew.aspx?idx=2";
  const postSelector =
    "#contaniner > article.specialMovie_detail_wrap > div > div > div.swiper.specialMovie_detail_inner_list.noneSlider > div";
  const movieInfoPage = "http://www.cgv.co.kr/movies/detail-view/?midx=";
  const movieNameSelector =
    "#select_main > div.sect-base-movie > div.box-contents > div.title > strong";
  const moviePostSelector =
    "#select_main > div.sect-base-movie > div.box-image > a > span > img";
  const screenTypeSelector =
    "#select_main > div.sect-base-movie > div.box-contents > span.screentype";
  // imax 포스트 id구하기
  const imaxMovieIdList = await getPostIdList(page, imaxPage, postSelector);
  //4dx 포스터 아이디 구하기
  const forDXMovieIdList = await getPostIdList(page, forDXPage, postSelector);
  // 중복id 제거
  const processingIdList = mergeArrays(imaxMovieIdList, forDXMovieIdList);

  const postDataList = [];

  // 데이터 챙기기
  for (let i = 0; i < processingIdList.length; i++) {
    await page.goto(movieInfoPage + processingIdList[i]);
    await Promise.all([
      page.waitForSelector(movieNameSelector),
      page.waitForSelector(moviePostSelector),
      page.waitForSelector(screenTypeSelector),
    ]);
    const postImg = await page.evaluate((moviePostSelector) => {
      const result = document.querySelector(moviePostSelector).src;
      return result;
    }, moviePostSelector);
    const movieName = await page.evaluate((movieNameSelector) => {
      const result = document.querySelector(movieNameSelector).textContent;
      return result;
    }, movieNameSelector);
    const cinemaTypeList = await page.$(screenTypeSelector);
    const cinemaType = await page.evaluate((cinemaTypeList) => {
      const result = [];
      for (let a = 0; a < cinemaTypeList.children.length; a++) {
        const screenType = cinemaTypeList.children[a].textContent.toLowerCase();
        console.log(screenType, "zz");
        if (screenType === "4dx" || screenType === "imax") {
          result.push(screenType);
        }
      }
      console.log(result);
      return result;
    }, cinemaTypeList);
    postDataList.push({
      postImg,
      movieName,
      cinemaType,
    });
  }

  //데이터 DB로보내기
  await axios.put(SERVER_URL + "movies", postDataList);
  console.log(postDataList);

  await page.close();
  await browser.close();
};

const getPostIdList = async (page, pageName, selector) => {
  await page.goto(pageName, { timeout: 60000 });
  await page.waitForSelector(selector);
  const mainDiv = await page.$(selector);
  const getMovieIdList = await page.evaluate((mainDiv) => {
    const movieIdList = [];
    const postList = mainDiv.children;
    for (let i = 0; i < postList.length; i++) {
      const post = postList[i].children[0];

      const urlString = post.href;
      const url = new URL(urlString);
      const midx = url.searchParams.get("midx");
      if (movieIdList.includes(midx)) continue;
      movieIdList.push(midx);
    }
    return movieIdList;
  }, mainDiv);
  return getMovieIdList;
};

movieCrawl();

const mergeArrays = (array1, array2) => {
  // 두 배열을 합칩니다.
  const mergedArray = [...array1, ...array2];

  // 중복을 제거합니다.
  const uniqueArray = [...new Set(mergedArray)];

  return uniqueArray;
};
