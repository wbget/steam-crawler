const Cheerio = require('cheerio');
const Crawler = require('crawler');
const fs = require('fs');

const GetUrl = (start, count) =>
  `https://store.steampowered.com/search/results/?query&start=${start}&count=${count}&dynamic_data=&sort_by=Released_DESC&term=%E4%BF%AE%E4%BB%99&force_infinite=1&snr=1_7_7_151_7&infinite=1`;

const DOWNLOAD = false;
const list = [];
const listMap = {};
const storeC = new Crawler({
  callback: (error, res, done) => {
    if (error) reject(error);
    const $ = Cheerio.load(res.body);
    const header = $('.game_header_image_full').attr('src');
    data = listMap[res.options.d];
    data.header = header;
    const desc = $('.game_description_snippet').text();
    data.desc = desc;
    const media = $('#highlight_player_area');
    const videos = [];
    data.videos = videos;
    media.find('.highlight_player_item.highlight_movie').each(function () {
      const v = $(this);
      const vr = v.attr('data-webm-source');
      videos.push(vr);
    });
    const imgs = [];
    data.imgs = imgs;
    media.find('.highlight_screenshot_link').each(function () {
      const i = $(this);
      const ir = i.attr('href');
      imgs.push(ir);
    });
    console.log(`抓取: ${data.title} 完成`);
    const dir = __dirname + `/dist/${data.title}`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    const raw = fs.createWriteStream(`${dir}/raw-data.json`);
    raw.write(JSON.stringify(data, null, '\t'));
    raw.end();
    done();
  },
});
const listC = new Crawler({
  maxConnections: 10,
  jQuery: false,
  callback: (error, res, done) => {
    if (error) {
      console.log(error);
    } else {
      const json = JSON.parse(res.body);
      const html = json.results_html;
      const $ = Cheerio.load(html);

      $('a').each(function () {
        let data = {};
        list.push(data);
        const id = Math.random().toFixed(8);
        listMap[id] = data;
        const item = $(this);
        const src = item.find('div img').attr('srcset');
        const thumb = src.split(',')[1].replace(' 2x', '');
        const title = item.find('.title').text();
        const storeURL = item.attr('href');
        data.thumb = thumb;
        data.title = title;
        data.storeURL = storeURL;
        storeC.queue({ url: storeURL, d: id });
      });
      done();
    }
  },
});

listC.queue([GetUrl(0, 50), GetUrl(50, 50)]);

let j = 0;
const downloads = [];
const downC = new Crawler({
  encoding: null,
  jQuery: false,
  callback: (err, res, done) => {
    if (err) {
      console.error(err.stack);
    } else {
      fs.createWriteStream(res.options.filename).write(res.body);
    }
    console.log(
      `下载文件: ${res.options.filename}...${(
        (j * 100) /
        downloads.length
      ).toFixed(2)}`
    );
    done();
  },
});
storeC.on('drain', () => {
  if (!DOWNLOAD) return;
  for (const data of list) {
    const dir = __dirname + `/dist/${data.title}`;
    downloads.push({ url: data.thumb, filename: `${dir}/thumb.jpg` });
    downloads.push({ url: data.header, filename: `${dir}/header.jpg` });
    data.imgs.forEach((url, index) => {
      downloads.push({ url, filename: `${dir}/imgage${index}.jpg` });
    });
    data.videos.forEach((url, index) => {
      downloads.push({ url, filename: `${dir}/video${index}.webm` });
    });
    downC.queue(downloads);
  }
});
