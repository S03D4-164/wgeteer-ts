//import { BrowserContext, Page, chromium } from 'patchright';
import { BrowserContext, Page, chromium } from 'rebrowser-playwright-core';
//process.env.REBROWSER_PATCHES_DEBUG = '1';
process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = 'addBinding';
import { protectIt } from './playwright-afp';

import WebpageModel from '../models/webpage';
import RequestModel from '../models/request';
import ResponseModel from '../models/response';

import logger from './logger';
import { savePayload, saveFullscreenshot, imgResize } from './playwgetSave';
import { saveRequest, saveResponse } from './playwgetIntercept';
import mongoose from 'mongoose';
import checkTurnstile from './turnstile';
import { yaraSource } from './yara';
import explainCode from './gemini';
//import flexDoc from './flexsearch';
import fs from 'fs';
import { execSync } from 'child_process';
import { Xvfb } from './node-xvfb';
import { spawn } from 'node:child_process';
import cleanup from './playwgetCleanup';

const dataDir = '/tmp/ppengo';

async function pptrEventSet(
  browserContext: BrowserContext,
  page: Page,
  webpage: any,
): Promise<void> {
  /*
  page.on('request', (request: any) => {
    //logger.debug(`Request: ${request.url()}`);
  });
  page.on('requestfinished', async (request: any) => {
    const res = await request.response();
    logger.debug(`Finished: ${res.url()}`);
  });
  page.on('requestfailed', (request: any) => {
    logger.debug(`Failed: ${request.failure().errorText} ${request.url()}`);
  });
    */
  const browser = browserContext.browser();
  if (browser) {
    browser.once('disconnected', () => logger.debug('browser disconnected'));
  }
  browserContext.once('close', () => logger.debug('browserContext closed'));
  page.once('crash', async (page: any) => {
    logger.error(`Page crashed: ${page.url()}`);
  });
  page.once('domcontentloaded', async (page: any) => {
    logger.debug(`DOM content loaded: ${page.url()}`);
  });
  page.once('close', async (page: any) => {
    logger.debug(`Page closed: ${page.url()}`);
  });
  page.once('load', async (page: any) => {
    logger.debug(`Page loaded: ${page.url()}`);
  });
  page.on('dialog', (dialog) => dialog.dismiss());
  // Log all uncaught errors to the terminal
  page.on('pageerror', (exception) => {
    logger.error(`Uncaught exception: "${exception}"`);
  });
  // download pdf
  if (webpage.option.pdf) {
    await page.route('**/*', async (route, request) => {
      if (
        request.resourceType() === 'document' &&
        route.request().url().endsWith('.pdf')
      ) {
        const response = await page.context().request.get(request.url());
        await route.fulfill({
          response,
          headers: {
            ...response.headers(),
            'Content-Disposition': 'attachment',
          },
        });
      } else {
        route.continue();
      }
    });
  }
  page.once('download', async (download) => {
    logger.info(`Download started: ${download.url()}`);
    async function readableToBuffer(readable: any): Promise<Buffer> {
      return new Promise((resolve, reject) => {
        const chunks: any = [];
        readable.on('data', (chunk: Buffer) => {
          logger.debug(`Received ${chunk.length} bytes of data.`);
          chunks.push(chunk);
        });
        readable.on('error', () => {
          logger.error('Error reading download stream');
          reject;
        });
        readable.on('end', () => {
          logger.info('Download stream ended.');
          resolve(Buffer.concat(chunks));
        });
      });
    }
    const read = await download.createReadStream();
    try {
      const buffer: any = await readableToBuffer(read);
      logger.debug(`Downloaded ${buffer.length} bytes of data.`);
      const payloadId: any = await savePayload(buffer);
      if (payloadId) {
        logger.debug(`Payload saved with ID: ${payloadId}`);
        webpage.payload = payloadId;
        webpage.error = 'A file has been downloaded.';
        await webpage.save();
      }
    } catch (err) {
      logger.error(`Error processing download: ${err}`);
    }
  });
}

async function genPage(
  webpage: any,
  chromiumArgs: any,
): Promise<{
  page: Page;
  browserContext: BrowserContext;
}> {
  const userDataDir = `${dataDir}/${webpage._id}`;
  logger.debug(`${userDataDir}`);
  try {
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
      executablePath: process.env.CHROME_EXECUTABLE_PATH,
      //executablePath: '/usr/bin/google-chrome-stable',
      channel: 'chrome',
      headless: false,
      viewport: null,
      recordHar: { path: `${userDataDir}/pw.har` },
      ignoreHTTPSErrors: true,
      args: chromiumArgs,
      ignoreDefaultArgs: ['--enable-automation'], // hide infobar
    });
    const permissions = ['notifications'];
    await browserContext.grantPermissions(permissions);
    //browserContext.setDefaultTimeout(30000);
    //const pages = browserContext.pages();
    //let page = pages[0];
    let page = await browserContext.newPage();
    //if (webpage.option?.afp)
    await protectIt(page, {});
    await pptrEventSet(browserContext, page, webpage);
    return {
      page: page as Page,
      browserContext: browserContext as BrowserContext,
    };
  } catch (err) {
    logger.error(err);
  }
  return { page: null as any, browserContext: null as any };
}

async function playwget(
  pageId: string | mongoose.Types.ObjectId | undefined,
): Promise<string | undefined> {
  logger.debug(`${pageId}: playwget start`);
  let webpage: any;
  try {
    webpage = await WebpageModel.findById(pageId).exec();
  } catch (err) {
    logger.error(`${pageId}: ${err}`);
  }
  //logger.debug(`webpage: ${webpage._id}`);

  if (!webpage) {
    logger.error(`${pageId}: not found`);
    return;
  }

  if (webpage.url || webpage.title) {
    logger.debug(`${pageId}: job has been terminated.`);
    webpage.error = 'job has been terminated.';
    await webpage.save();
    return webpage._id;
  }

  const displayNum = `${Math.floor(Math.random() * (99999 - 99)) + 99}`;
  await cleanup(webpage._id, displayNum);

  const chromiumArgs = [
    '--no-sandbox',
    '--start-maximized',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-automation',
    '--disable-infobars',
    `--display=:${displayNum}`,
  ];
  if (webpage.option?.proxy) {
    if (
      webpage.option.proxy.match(/^\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}:\d{1,5}$/)
    ) {
      chromiumArgs.push(`--proxy-server=${webpage.option.proxy}`);
    }
  }
  //logger.debug(webpage.option);

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

  let exHeaders: Record<string, string> = {};
  if (webpage.option?.lang) {
    exHeaders['Accept-Language'] = webpage.option.lang;
  }
  if (webpage.option?.exHeaders) {
    for (const line of webpage.option.exHeaders.split('\r\n')) {
      const match = line.match(/^([^:]+):(.+)$/);
      if (match && match.length >= 3) {
        exHeaders[match[1].trim()] = match[2].trim();
      }
    }
  }

  let { page, browserContext } = await genPage(webpage, chromiumArgs);

  if (!page || !browserContext) {
    logger.error(`${pageId}: Failed to create page or browser context`);
    return;
  }
  //const browser = browserContext.browser();
  if (webpage.option?.userAgent && webpage.option.userAgent.length > 1) {
    //await page.setUserAgent(webpage.option.userAgent);
  }
  if (webpage.option?.disableScript) {
    //await page.setJavaScriptEnabled(false);
  } else {
    //await page.setJavaScriptEnabled(true);
  }
  if (exHeaders) {
    await page.setExtraHTTPHeaders(exHeaders);
  }
  await page.setViewportSize({ width: 1280, height: 700 });
  let waitUntilOption: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' =
    'load';
  if (webpage.option?.dom) {
    waitUntilOption = 'domcontentloaded';
  }

  const client = await page.context().newCDPSession(page);

  //intercept
  let responseCache: any[] = [];
  let requestArray: any[] = [];
  let responseArray: any[] = [];

  //await client.send('Network.enable');
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
      /*logger.debug(
        `[Intercepted] ${requestId}, ${responseStatusCode}, ${request.url}`,
      );*/

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
          /*logger.debug(
            `[Intercepted] ${err.message} ${responseStatusCode} ${request.url}`,
          );*/
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
  page.on('requestfailed', async function (request: any) {
    logger.debug(
      `${pageId}: ${request.failure()} ${request.url().slice(0, 100)}`,
    );
    await docToArray(request);
  });

  page.on('requestfinished', async function (request: any) {
    await docToArray(request);
  });

  async function docToArray(request: any): Promise<void> {
    try {
      /*
      logger.debug(
        `[Request] finished: ${request.method()} ${request.url().slice(0, 100)}`,
      );
      */
      let req: any = await saveRequest(request, webpage._id);
      //console.log(req);
      const response = await request.response();
      let res;
      if (response) {
        /*
        logger.debug(
          `[Request] response: ${response.status()} ${response.url().slice(0, 100)}`,
        );
        */
        res = await saveResponse(response, webpage._id, responseCache);
        if (res && responseArray != null) {
          responseArray.push(res);
        }
        req.interceptionId = res?.interceptionId;
      }
      if (req && requestArray != null) {
        requestArray.push(req);
      }
      /*
      if (requestArray != null && requestArray != null) {
        console.log(
          req.interceptionId,
          res?.interceptionId,
          requestArray.length,
          responseArray.length,
          request.method(),
          request.url().slice(0, 100),
        );
      }
      */
    } catch (error: any) {
      logger.error(error);
    }
  }
  /*
  await client.send('Network.enable');

  // Store the favicon data here
  const faviconData: { [url: string]: any } = {};

  // Listen for favicon responses
  client.on('Network.responseReceived', async (params) => {
    const { response, requestId } = params; // Extract requestId here
    console.log(response.url);
    if (
      response.url.endsWith('favicon.ico') ||
      response.url.includes('/favicon')
    ) {
      //console.log(`Favicon response received: ${response.url}`);
      // Fetch response body via CDP using the correct requestId
      const { body, base64Encoded } = await client.send(
        'Network.getResponseBody',
        { requestId },
      );
      // Store or process the favicon data
      faviconData[response.url] = base64Encoded
        ? Buffer.from(body, 'base64')
        : body;
    }
  });
  */
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

    // execute actions
    let actions;
    let yararule = await yaraSource(await page.content());
    if (yararule?.actions) {
      logger.debug(`${webpage._id}: ${yararule}`);
      actions = yararule.actions;
      webpage.yara = yararule;
    }
    if (webpage.option.actions) {
      actions = webpage.option.actions;
    }
    if (actions && actions.length > 1) {
      webpage.option.actions = actions;
      const lines = actions.split('\r\n');
      let limit = 5;
      let ssarray: any[] = [];
      for (let line of lines) {
        // screenshot before action
        let ssobj: any = {};
        let screenshot = await page.screenshot({
          fullPage: false,
          timeout: delay,
        });
        const resizedImg = await imgResize(screenshot);
        if (resizedImg) {
          ssobj.thumbnail = resizedImg.toString('base64');
        }
        let fullscreenshot = await page.screenshot({
          fullPage: true,
          timeout: delay,
        });
        let fss = await saveFullscreenshot(fullscreenshot);
        if (fss) {
          ssobj.full = new mongoose.Types.ObjectId(fss);
        }
        //console.log(ssobj);
        ssarray.push(ssobj);
        // actions
        let elem = line.split('>');
        let action = elem[0]?.trim();
        let target = elem[1]?.trim();
        let input = elem[2]?.trim();
        logger.debug(`${pageId}: action: ${action}, target: ${target}`);
        if (action == 'click') {
          await page.locator(target).click();
        } else if (action == 'eval') {
          await page.evaluate(target);
        } else if (action == 'fill') {
          await page.locator(target).pressSequentially(input);
        } else if (action == 'press') {
          await page.locator(target).press(input);
        }
        await new Promise((done) => setTimeout(done, delay));
        limit--;
        if (limit <= 0) break;
      }
      //console.log(ssarray);
      if (ssarray.length > 0) {
        webpage.screenshots = ssarray;
      }
    }
  } catch (err: any) {
    logger.error(`${pageId}: ${page.isClosed()} ${err}`);
    if (page.isClosed()) {
      return;
    } else {
      webpage.error = err.message;
    }
  }
  logger.debug(`${pageId}: goto completed ${webpage.input}`);

  try {
    webpage.url = page.url();
    logger.debug(`${pageId}: ${webpage.url}`);
    webpage.title = await page.title();
    logger.debug(`${pageId}: ${webpage.title}`);
    webpage.content = await page.content();
    /*
    let screenshot = await page.screenshot({
      fullPage: false,
      timeout: webpage.option.delay * 10000,
      animations: 'disabled',
    });*/
    const client = await page.context().newCDPSession(page);
    const base64ss = (
      await client.send('Page.captureScreenshot', {
        captureBeyondViewport: true,
        optimizeForSpeed: true,
      })
    ).data;
    let screenshot = Buffer.from(base64ss, 'base64');
    const resizedImg = await imgResize(screenshot);
    webpage.thumbnail = resizedImg.toString('base64');
    /*let fullscreenshot = await page.screenshot({
      fullPage: true,
      timeout: webpage.option.delay * 10000,
    });*/
    let fullscreenshot = screenshot;
    let fss = await saveFullscreenshot(fullscreenshot);
    if (fss) {
      webpage.screenshot = new mongoose.Types.ObjectId(fss);
    }
    const pngPath = `${dataDir}/${webpage._id}/screenshot.png`;
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
      let fss = await saveFullscreenshot(pngData);
      if (fss) {
        ssobj.full = new mongoose.Types.ObjectId(fss);
      }
      webpage.screenshots.push(ssobj);
    }
    /*
    if (faviconData) {
      for (const [url, data] of Object.entries(faviconData)) {
        webpage.favicon.push({
          url,
          favicon: data.toString('base64'),
        });
      }
    }
    */
    //explainCode(webpage.content);
  } catch (err: any) {
    logger.error(`${pageId}: ${page.isClosed()} ${err}`);
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
      logger.debug(`${pageId}: request save ${requestArray.length}`);
      //console.log(requestArray);
      requests = await RequestModel.insertMany(requestArray, {
        ordered: false,
      });
      let end = new Date();
      let time = Number(end) - Number(start);
      logger.debug(
        `${pageId}: request saved ${requests.length} Execution time: ${time}ms`,
      );
    } catch (err: any) {
      logger.error(`${pageId}: ${err}`);
    }
  }

  let responses = (await ResponseModel.find({ webpage })) || [];
  if (responses.length == 0) {
    if (webpage.option.bulksave) {
      try {
        let start = new Date();
        logger.debug(`${pageId}: response bulk save ${responseArray.length}`);
        responses = await ResponseModel.insertMany(responseArray, {
          ordered: false,
          //rawResult: true,
        });
        let end = new Date();
        let time = Number(end) - Number(start);
        logger.debug(
          `${pageId}: response bulk saved ${responses.length} Execution time: ${time}ms`,
        );
      } catch (err: any) {
        logger.error(`${pageId}: ${err}`);
      }
    }
  }
  if (responses.length == 0) {
    let start = new Date();
    logger.debug(`${pageId}: response save ${responseArray.length}`);
    for (let res of responseArray) {
      try {
        const newRes = new ResponseModel(res);
        await newRes.save();
        responses.push(newRes);
      } catch (err) {
        logger.error(`${pageId}: response save ${err}`);
      }
    }
    let end = new Date();
    let time = Number(end) - Number(start);
    logger.debug(
      `${pageId}: response saved ${responses.length} Execution time: ${time}ms`,
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
    logger.debug(`${pageId}: webpage saved`);
    return webpage._id;
  } catch (err) {
    logger.error(`${pageId}: ${err}`);
    return undefined;
  }
}

export default playwget;
