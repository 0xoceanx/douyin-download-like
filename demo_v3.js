const axios = require("axios");
const fs = require("fs");
const sanitize = require("sanitize-filename");
const util = require("util");
const stream = require("stream");
const { firefox } = require("playwright");
// const pipeline = util.promisify(stream.pipeline);
const finished = util.promisify(stream.finished);

async function get_detail(url) {
  let id = "";
  let api_url = "https://www.iesdouyin.com/aweme/v1/web/aweme/detail/?aweme_id=";

  if (url.includes("https://www.douyin.com/note/")) {
    id = url.replace("https://www.douyin.com/note/", "");
  } else if (url.includes("https://www.douyin.com/video/")) {
    id = url.replace("https://www.douyin.com/video/", "");
  } else {
    throw "invalid url";
  }
  let target_url = api_url + id + "&aid=1128&version_name=23.5.0&device_platform=android&os_version=2333";
  let detail = {};
  let headers = [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)",
    "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
    "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
    "Mozilla/5.0 (compatible; DuckDuckBot/1.0; +http://duckduckgo.com/duckduckbot.html)",
    "Mozilla/5.0 (compatible; Sogou web spider/4.0; +http://www.sogou.com/docs/help/webmasters.htm#07)",
    "Mozilla/5.0 (compatible; Exabot/3.0; +http://www.exabot.com/go/robot)",
    "Mozilla/5.0 (compatible; AhrefsBot/6.1; +http://ahrefs.com/robot/)",
    "Mozilla/5.0 (compatible; SemrushBot/3~bl; +http://www.semrush.com/bot.html)",
    "Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://www.majestic12.co.uk/bot.php?+)",
  ];
  await axios({
    method: "get",
    url: target_url,
    headers: {
      "User-Agent": headers[Math.floor(Math.random() * headers.length)],
    },
    timeout: 1000,
  }).then((res) => {
    result = res.data["aweme_detail"];
    process.stdout.write("\u001b[32m" + "nickname: " + result["author"]["nickname"] + "  ");
    process.stdout.write("\u001b[31m" + result["desc"] + "  \r\n" + "\u001b[0m");
    // if is video
    if (result["images"] == null) {
      detail["type"] = "video";
      detail["url"] = result["video"]["bit_rate"][0]["play_addr"]["url_list"][0];
      detail["nickname"] = result["author"]["nickname"];
      detail["desc"] = result["desc"];
    } else {
      // if is pic
      detail["type"] = "image";
      detail["url"] = [];
      detail["nickname"] = result["author"]["nickname"];
      detail["desc"] = result["desc"];
      let images = result["images"];
      for (let i in images) {
        detail["url"].push(images[i]["url_list"][3]);
      }
    }
  });
  return detail;
}

async function download(url, output_filename) {
  const writer = fs.createWriteStream(output_filename);
  return axios({
    method: "get",
    url: url,
    responseType: "stream",
  }).then((response) => {
    response.data.pipe(writer);
    return finished(writer); // A Promise
  });
}

async function run() {
  let cancel = false;
  console.log("start downloading");
  const target_file_path = __dirname + "\\config\\target.txt";
  const error_file_path = __dirname + "\\config\\error.txt";
  const log_file_path = __dirname + "\\config\\log.txt";
  // init target and clear errors
  fs.writeFileSync(error_file_path, "");
  target = fs.readFileSync(target_file_path, "utf-8").split("\r\n");
  let detail = "";
  let previous_count = 0;
  let output_folder = "C:\\Users\\oceanx\\AppData\\Local\\douyin\\app-0.0.1\\resources\\app\\video\\";
  while (!cancel) {
    // get file list of video folder
    let file_list = fs.readdirSync(output_folder);
    for (let i in target) {
      process.stdout.write(i + " ----- ");
      try {
        detail = await get_detail(target[i]);
        // check if exist
        let tmp1 = sanitize(detail["nickname"] + "_" + detail["desc"]).substring(0, 170) + ".mp4";
        let tmp2 = sanitize(detail["nickname"] + "_" + detail["desc"]).substring(0, 170) + "_0" + ".jpg";
        if (file_list.includes(tmp1) || file_list.includes(tmp2)) {
          process.stdout.write("exist\r\n");
          continue;
        }
        if (detail["type"] == "video") {
          let filename = sanitize(detail["nickname"] + "_" + detail["desc"]).substring(0, 170) + ".mp4";
          await download(detail["url"], output_folder + filename);
        } else if (detail["type"] == "image") {
          for (let j in detail["url"]) {
            let filename = sanitize(detail["nickname"] + "_" + detail["desc"]).substring(0, 170) + "_" + j + ".jpg";
            await download(detail["url"][j], output_folder + filename);
          }
        }
      } catch (e) {
        fs.writeFileSync(log_file_path, new Date() + " " + target[i] + " : " + e + "\r\n", {
          flag: "a",
        });
        // write to error.txt
        fs.writeFileSync(error_file_path, target[i] + "\r\n", {
          flag: "a",
        });
      }
    }
    // after one round of download, check if there is new target
    let errors = fs.readFileSync(error_file_path, "utf-8").split("\r\n");
    if (errors.length == 0 || errors.length - 1 == previous_count) {
      cancel = true; // cancel if still can't download
    } else if (errors.length != previous_count) {
      previous_count = errors.length; // retry
      target = errors; // refresh target
      fs.writeFileSync(error_file_path, ""); // clear error.txt
    }
  }
  console.log("please manually check errors.txt");
}

var like_tab = "https://www.douyin.com/user/MS4wLjABAAAAEtx9PZ1XhEw-eB4fUg_t4M9OnspG38qgWLZW4cG4yrc?showTab=like";
var context = null;
var browser = null;
var LIMIT = 1000;
var isheadless = false;
async function init() {
  browser = await firefox.launch({ headless: isheadless });
  context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0",
    viewport: { width: 2000, height: 1000 },
  });
  context.setDefaultTimeout(1000000000);
}

// LIKE ADDRESS
async function get_likes() {
  let target_file_path = __dirname + "\\config\\target.txt";
  // document.querySelector("div.FeJSrpNN:nth-child(3) > ul:nth-child(1)")
  let address = [];
  const page = await context.newPage();
  await page.goto(like_tab);

  //wait for appearance
  await page.waitForSelector(".captcha_verify_container", {
    state: "attached",
  });
  // wait for its disappearance
  await page.waitForSelector(".captcha_verify_container", {
    state: "detached",
  });
  // wait for the web version to load
  await page.waitForSelector(".dy-account-close", {
    state: "attached",
  });

  // check which web version is used.
  const web_version = page.locator("div.FeJSrpNN:nth-child(3) > ul:nth-child(1)");
  let mobile_like = await web_version.count();
  if (!mobile_like) {
    while (true) {
      //check if login window pop up
      const captcha_locator = page.locator(".verify-bar-close--icon");
      const locator = page.locator(".dy-account-close");
      const refresh_locator = page.locator(".OodIpDwK");

      let fuck_captcha = await captcha_locator.count();
      if (fuck_captcha) {
        console.log("captcha !!!!!!!!!!!!!!!!!!");
        console.log("please turn on headful mode and solve the captcha");
        await page.waitForSelector(".verify-bar-close--icon", {
          state: "hidden",
        });
      }
      let need_close = await locator.count();
      if (need_close) {
        // console.log("close login window");
        await locator.click();
        await page.waitForSelector(".dy-account-close", {
          state: "hidden",
        });
      }
      // check if bottom refresh needed
      let need_refresh = await refresh_locator.count();
      if (need_refresh) {
        // console.log("refresh");
        await refresh_locator.click();
      }
      // scroll down
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      address = await page.evaluate((LIMIT) => {
        let address = [];
        let nodes = document.querySelector(".EZC0YBrG").childNodes;
        if (nodes.length > LIMIT) {
          nodes.forEach((node) => {
            address.push(node.firstChild.href);
          });
        }
        return address;
      }, LIMIT);
      if (address.length != 0) {
        break;
      }
    }
    fs.writeFileSync(target_file_path, address.join("\r\n"));
    browser.close();
    return true;
  } else {
    console.log("Please retry");
    browser.close();
    return false;
  }
}

async function get_like_list() {
  await init();
  await get_likes();
}

var keep_mode_on = false;
var time_to_wait = 1000 * 60 * 10; //  10 min

async function keep_download_mode() {
  if (keep_mode_on == true) {
    console.log("alert: keep mode is already on");
    return;
  } else {
    keep_mode_on = true;
    console.log("keep mode on");
  }
  while (keep_mode_on) {
    while ((await get_like_list()) == false) {
      console.log("retrying get like list");
    }
    await run();
    await new Promise((resolve) => {
      setTimeout(resolve, time_to_wait);
    });
  }
}

function stop_keep_download_mode() {
  if (keep_mode_on == false) {
    console.log("alert: keep mode is already off");
  } else {
    keep_mode_on = false;
    console.log("keep mode off");
  }
}

module.exports = {
  run,
  get_like_list,
  keep_download_mode,
  stop_keep_download_mode,
};
