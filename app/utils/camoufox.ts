//import { protectIt } from './playwright-afp';
import { Camoufox, launchOptions } from 'camoufox-js';
import { firefox } from 'playwright-core';

import WebpageModel from '../models/webpage';
import RequestModel from '../models/request';
import ResponseModel from '../models/response';

import logger from './logger';
import { saveRequest, saveResponse } from './playwgetIntercept';
import { imgResize, saveFullscreenshot } from './playwgetScreenshot';

import mongoose from 'mongoose';
import checkTurnstile from './turnstile';

import fs from 'fs';
import { execSync } from 'child_process';
import { Xvfb } from './node-xvfb';
import { spawn } from 'node:child_process';
import cleanup from './playwgetCleanup';
import { playwgetAction } from './playwgetAction';
import pptrEventSet from './playwgetEvent';

const dataDir = process.env.DATA_DIR || '/tmp/ppengo';

async function genFox(
  webpage: any,
  browserArgs: any,
): Promise<{
  page: any;
  browserContext: any;
}> {
  const pageId = webpage._id;
  const userDataDir = `${dataDir}/${pageId}`;
  logger.debug(firefox.executablePath());

  let options: any = {
    //executablePath: '/usr/bin/google-chrome-stable',
    viewport: null,
    ignoreHTTPSErrors: true,
    args: browserArgs,
    //ignoreDefaultArgs: ['--enable-automation'], // hide infobar
    javaScriptEnabled: true,
  };
  if (webpage.option?.disableScript) {
    options.javaScriptEnabled = false;
  }

  let exHeaders: Record<string, string> = {};
  if (webpage.option?.exHeaders) {
    for (const line of webpage.option.exHeaders.split('\r\n')) {
      const match = line.match(/^([^:]+):(.+)$/);
      if (match && match.length >= 3) {
        exHeaders[match[1].trim()] = match[2].trim();
      }
    }
  }
  if (exHeaders) {
    options.extraHTTPHeaders = exHeaders;
  }

  try {
    const window: [number, number] = [1280, 720];
    const os: ['windows', 'macos', 'linux'] = ['windows', 'macos', 'linux'];
    const camopt: any = {
      os: os[0],
      debug: true,
      iKnowWhatImDoing: true,
      persistent_context: true,
      user_data_dir: userDataDir,
      headless: false,
      recordHar: { path: `${userDataDir}/pw.har` },
      geoip: true,
      window,
    };
    if (webpage.option?.userAgent && webpage.option.userAgent.length > 1) {
      camopt.config['navigator.userAgent'] = webpage.option.userAgent;
    }
    if (webpage.option?.lang) {
      if (webpage.option.lang === 'ja') {
        camopt.locale = 'JP';
        camopt.geoip = true;
      } else if (webpage.option.lang === 'en') {
        camopt.locale = 'US';
        camopt.geoip = false;
      }
    }
    if (webpage.option?.proxy) {
      if (
        webpage.option.proxy.match(/\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}:\d{1,5}$/)
      ) {
        camopt.proxy = {
          server: webpage.option.proxy,
        };
        camopt.geoip = true;
      }
    }
    console.log(camopt);
    const browserContext = await firefox.launchPersistentContext(userDataDir, {
      ...(await launchOptions(camopt)),
      ...options,
    });

    const browser = browserContext.browser();
    let page;
    if (browser) {
      page = await browser.newPage();
    }
    const permissions = ['notifications'];
    await browserContext.grantPermissions(permissions);
    browserContext.setDefaultTimeout(30000);
    return {
      page,
      browserContext,
    };
  } catch (err) {
    logger.error(`[${pageId}] ${err}`);
  }
  return { page: null, browserContext: null };
}

// main
async function camowget(pageId: string): Promise<string | undefined> {
  logger.debug(`[${pageId}] camowget start`);
  let webpage: any;
  try {
    webpage = await WebpageModel.findById(pageId).exec();
  } catch (err) {
    logger.error(`[${pageId}] ${err}`);
  }
  //logger.debug(`webpage: ${webpage._id}`);

  if (!webpage) {
    logger.error(`[${pageId}] not found`);
    return;
  }

  if (webpage.url || webpage.title) {
    logger.debug(`[${pageId}] job has been terminated.`);
    webpage.error = 'job has been terminated.';
    await webpage.save();
    return pageId;
  }

  const displayNum = `${Math.floor(Math.random() * (99999 - 99)) + 99}`;
  await cleanup(pageId, undefined);

  const xvfb = new Xvfb({
    displayNum,
    reuse: false,
    timeout: 1000,
    silent: false,
    xvfb_args: [
      '-screen',
      '0',
      '1280x720x24',
      '-ac',
      '-nolisten',
      'tcp',
      '-nolisten',
      'unix',
    ],
  });
  xvfb.startSync();
  await new Promise((done) => setTimeout(done, 3000));

  const fluxbox = spawn(
    '/usr/bin/fluxbox',
    ['-display', `:${displayNum}`, '-screen', '0'],
    { detached: true, timeout: 5 * 60 * 1000 },
  );
  await new Promise((done) => setTimeout(done, 3000));

  await fs.promises.mkdir(`${dataDir}/${webpage._id}`, { recursive: true });
  await fs.promises.writeFile(
    `${dataDir}/${webpage._id}/displayNum`,
    displayNum,
  );

  const browserArgs = [
    /*
    '--no-sandbox',
    '--start-maximized',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-automation',
    '--disable-infobars',
    */
    `--display=:${displayNum}`,
  ];

  let { page, browserContext } = await genFox(webpage, browserArgs);

  if (!page || !browserContext) {
    logger.error(`[${pageId}] Failed to create page or browser context`);
    return;
  }

  await pptrEventSet(browserContext, page, webpage);

  await page.setViewportSize({ width: 1280, height: 700 });
  let waitUntilOption: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' =
    'load';
  if (webpage.option?.dom) {
    waitUntilOption = 'domcontentloaded';
  }

  //const client = await page.context().newCDPSession(page);

  //intercept
  let responseCache: any[] = [];
  let requestArray: any[] = [];
  let responseArray: any[] = [];
  let interceptionId = 0;
  /*
  await client.send('Fetch.enable', {
    patterns: [
      {
        urlPattern: '*',
        requestStage: 'Response',
      },
    ],
  });
  client.on(
    'Fetch.requestPaused',
    async ({ requestId, request, responseStatusCode }: any) => {

    
      let cache: {
        url: string;
        status: number;
        body: string | Buffer | null;
        interceptionId: string;
      } = {
        url: request.url,
        status: responseStatusCode || 0,
        body: null,
        interceptionId: requestId,
      };
      try {
        if (requestId) {
          let response = await client.send('Fetch.getResponseBody', {
            requestId,
          });
          let newBody = (response as { body: string; base64Encoded: boolean })
            .base64Encoded
            ? Buffer.from(
                (response as { body: string; base64Encoded: boolean }).body,
                'base64',
              )
            : (response as { body: string; base64Encoded: boolean }).body;
          cache.body = newBody;
        }
      } catch (err: any) {
        if (err.message) {

        }
      }
      responseCache.push(cache);

      try {
        if (client)
          await client.send('Fetch.continueRequest', {
            requestId,
          });
      } catch (err: any) {
        logger.debug(err);
      }
    },
  );
  */
  page.on('requestfailed', async function (request: any) {
    await docToArray(request);
  });

  page.on('requestfinished', async function (request: any) {
    await docToArray(request);
  });

  async function docToArray(request: any): Promise<void> {
    interceptionId++;
    try {
      logger.debug(
        `[Request] finished: ${request.method()} ${request.url().slice(0, 100)}`,
      );

      let req: any = await saveRequest(request, pageId);
      //console.log(req);
      const response = await request.response();
      let res;
      if (response) {
        /*
        logger.debug(
          `[Request] response: ${response.status()} ${response.url().slice(0, 100)}`,
        );
        */
        res = await saveResponse(response, pageId, responseCache);
        if (res && responseArray != null) {
          //res.interceptionId = interceptionId;
          responseArray.push(res);
        }
        //req.interceptionId = interceptionId;
      }
      if (req && requestArray != null) {
        requestArray.push(req);
      }
    } catch (error: any) {
      logger.error(error);
    }
  }

  try {
    await page.goto(webpage.input, {
      timeout: webpage.option.timeout * 1000,
      referer: webpage.option.referer,
      waitUntil: waitUntilOption,
    });
    const delay = webpage.option.delay * 1000;
    await new Promise((done) => setTimeout(done, delay));
    // Turnstile check
    await checkTurnstile(page);
    await playwgetAction(page, webpage, undefined);
  } catch (err: any) {
    logger.error(`[${pageId}] ${page.isClosed()} ${err}`);
    if (page.isClosed()) {
      return;
    } else {
      webpage.error = err.message;
    }
  }
  logger.debug(`[${pageId}] goto completed ${webpage.input}`);

  try {
    webpage.url = page.url();
    logger.debug(`[${pageId}] ${webpage.url}`);
    webpage.title = await page.title();
    logger.debug(`[${pageId}] ${webpage.title}`);
    webpage.content = await page.content();

    let screenshot = await page.screenshot({
      fullPage: true,
    });
    const resizedImg = await imgResize(screenshot);
    webpage.thumbnail = resizedImg.toString('base64');
    let fss = await saveFullscreenshot(screenshot, []);
    if (fss) {
      webpage.screenshot = new mongoose.Types.ObjectId(fss);
    }
    const pngPath = `${dataDir}/${pageId}/screenshot.png`;
    const xwd = execSync(
      `xwd -display :${displayNum} -root -silent | convert xwd:- png:${pngPath}`,
    );
    if (fs.existsSync(pngPath)) {
      const pngData = fs.readFileSync(pngPath);
      let ssobj: any = {};
      const resizedImg = await imgResize(pngData);
      if (resizedImg) {
        ssobj.thumbnail = resizedImg.toString('base64');
      }
      let tag = [
        {
          url: webpage.url,
        },
      ];
      let fss = await saveFullscreenshot(pngData, tag);
      if (fss) {
        ssobj.full = new mongoose.Types.ObjectId(fss);
      }
      webpage.screenshots.push(ssobj);
    }
  } catch (err: any) {
    logger.error(`[${pageId}] ${page.isClosed()} ${err}`);
    if (page.isClosed()) {
      return;
    } else {
      if (!webpage.error) {
        webpage.error = err.message;
      }
    }
  }

  let requests = (await RequestModel.find({ webpage })) || [];
  if (requests.length == 0) {
    try {
      let start = new Date();
      logger.debug(`[${pageId}] request save: ${requestArray.length}`);
      //console.log(requestArray);
      requests = await RequestModel.insertMany(requestArray, {
        ordered: false,
      });
      let end = new Date();
      let time = Number(end) - Number(start);
      logger.debug(
        `[${pageId}] request saved: ${requests.length} Execution time: ${time}ms`,
      );
    } catch (err: any) {
      logger.error(`[${pageId}] ${err}`);
    }
  }

  let responses = (await ResponseModel.find({ webpage })) || [];
  if (responses.length == 0) {
    if (webpage.option.bulksave) {
      try {
        let start = new Date();
        logger.debug(`[${pageId}] response bulk save: ${responseArray.length}`);
        responses = await ResponseModel.insertMany(responseArray, {
          ordered: false,
          //rawResult: true,
        });
        let end = new Date();
        let time = Number(end) - Number(start);
        logger.debug(
          `[${pageId}] response bulk saved: ${responses.length} Execution time: ${time}ms`,
        );
      } catch (err: any) {
        logger.error(`[${pageId}] ${err}`);
      }
    }
  }
  if (responses.length == 0) {
    let start = new Date();
    logger.debug(`[${pageId}] response save: ${responseArray.length}`);
    for (let res of responseArray) {
      try {
        const newRes = new ResponseModel(res);
        await newRes.save();
        responses.push(newRes);
      } catch (err) {
        logger.error(`[${pageId}] response save ${err}`);
      }
    }
    let end = new Date();
    let time = Number(end) - Number(start);
    logger.debug(
      `[${pageId}] response saved: ${responses.length} Execution time: ${time}ms`,
    );
  }

  try {
    await webpage.save();
    //flexDoc(webpage);
    // Waits for all the reported 'request' events to resolve.
    //page.removeAllListeners();
    //await page.close();
    //await browserContext.clearPermissions();
    //await browserContext.clearCookies();
    //browserContext.removeAllListeners();
    const browser = browserContext.browser();
    await browserContext.close();
    await new Promise((done) => setTimeout(done, 1000));
    await browser?.close();
    await new Promise((done) => setTimeout(done, 1000));
    xvfb.stopSync();
    logger.debug(`[${pageId}] webpage saved`);
    return pageId;
  } catch (err) {
    logger.error(`[${pageId}] ${err}`);
    return undefined;
  }
}

export default camowget;
export { dataDir };
