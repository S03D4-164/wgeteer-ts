//import { BrowserContext, Page, chromium } from 'patchright';
import {
  Browser,
  BrowserContext,
  Page,
  chromium,
} from 'rebrowser-playwright-core';
//process.env.REBROWSER_PATCHES_DEBUG = '1';
process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = 'addBinding';
import { protectIt } from './playwright-afp';
//import { connect } from './playwright-real-browser';

import WebpageModel from '../models/webpage';
import logger from './logger';
import findProc from 'find-process';
import { savePayload, saveFullscreenshot, imgResize } from './playwgetSave';
import mongoose from 'mongoose';
import checkTurnstile from './turnstile';
import { yaraSource } from './yara';
import explainCode from './gemini';
import flexDoc from './flexsearch';
import fs from 'fs';
import { execSync } from 'child_process';
import { Xvfb } from './node-xvfb';
import { spawn } from 'node:child_process';

const dataDir = '/tmp/ppengo';

async function pptrEventSet(
  browserContext: BrowserContext,
  page: Page,
  webpage: any,
): Promise<void> {
  /*
  const browser = browserContext.browser();
  if (browser) {
    browser.on('disconnected', () => logger.debug('browser disconnected'));
  }
  browserContext.on('close', () => logger.debug('browserContext closed'));
  page.on('request', (request: any) => {
    //logger.debug(`Request: ${request.url()}`);
  });
  */
  page.on('requestfinished', async (request: any) => {
    const res = await request.response();
    logger.debug(`Finished: ${res.url()}`);
  });
  page.on('requestfailed', (request: any) => {
    logger.debug(`Failed: ${request.failure().errorText} ${request.url()}`);
  });
  page.on('crash', () => {
    console.log('Page crashed');
  });

  page.once('domcontentloaded', () => {
    logger.debug('DOM content loaded');
  });
  page.once('close', () => {
    logger.debug('Page closed');
  });
  page.once('load', () => {
    logger.debug('Page loaded');
  });
  page.on('dialog', (dialog) => dialog.dismiss());
  // Log all uncaught errors to the terminal
  page.on('pageerror', (exception) => {
    logger.error(`Uncaught exception: "${exception}"`);
  });
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
/*
async function realPage(
  webpage: any,
  chromiumArgs: any,
): Promise<{
  page: Page;
  browserContext: BrowserContext;
}> {
  //process.env.CHROME_PATH = executablePath;
  await fs.promises.mkdir(`${dataDir}/${webpage._id}`, { recursive: true });
  const { page: connectedPage, browser: connectedBrowser } = await connect({
    headless: false,
    args: chromiumArgs,
    customConfig: {
      userDataDir: `${dataDir}/${webpage._id}`,
      executablePath: '/usr/bin/google-chrome-stable',
    },
    turnstile: true,
    connectOption: {
      defaultViewport: null,
    },
  });
  console.log(chromiumArgs);

  const page = connectedPage as any;
  const browser = connectedBrowser as any;
  const browserContext = browser.contexts()[0];
  try {
    await pptrEventSet(browserContext, page, webpage);
    const browserVersion = await browser.version();
    logger.debug(`${browserVersion}, ${page}`);
  } catch (err) {
    console.log(err);
  }
  return { page, browserContext };
}
*/

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
      //executablePath: process.env.CHROME_EXECUTABLE_PATH,
      executablePath: '/usr/bin/google-chrome-stable',
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

//async function playwget(pageId: string): Promise<string | undefined> {
async function playwget(
  pageId: string | mongoose.Types.ObjectId | undefined,
): Promise<string | undefined> {
  logger.debug(`playwget start: ${pageId}`);
  let webpage: any;
  try {
    webpage = await WebpageModel.findById(pageId).exec();
  } catch (e) {
    logger.error(e);
    return;
  }
  logger.debug(`webpage: ${webpage._id}`);

  if (!webpage) {
    logger.error(`page ${pageId} not found`);
    return;
  }

  try {
    const list = await findProc('name', 'chrome');
    if (list) {
      for (const ps of list) {
        if (ps.name === 'chrome' && ps.cmd.includes(`/tmp/${webpage._id}`)) {
          console.log('kill', ps);
          process.kill(ps.pid);
        }
      }
    }
  } catch (err) {
    logger.error(err);
  }

  if (webpage.url || webpage.title) {
    webpage.error = 'job has been terminated.';
    await webpage.save();
    return webpage._id;
  }

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
  const displayNum = `${Math.floor(Math.random() * (99999 - 99)) + 99}`;
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
  logger.debug(webpage.option);

  const xvfb = new Xvfb({
    displayNum,
    reuse: false,
    timeout: 1000,
    silent: false,
    xvfb_args: ['-screen', '0', '1280x720x24', '-ac'],
  });
  xvfb.startSync();
  await new Promise((done) => setTimeout(done, 3000));

  const fluxbox = spawn(
    '/usr/bin/fluxbox',
    ['-display', `:${displayNum}`, '-screen', '0'],
    { detached: true, timeout: 5 * 60 * 1000 },
  );
  await new Promise((done) => setTimeout(done, 3000));

  let { page, browserContext } = await genPage(webpage, chromiumArgs);
  //let { page, browserContext } = await realPage(webpage, chromiumArgs);
  if (!page || !browserContext) {
    logger.error('Failed to create page or browser context');
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

  //const client = await page.context().newCDPSession(page);
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
    const solved = await checkTurnstile(page);
    if (solved) {
      await new Promise((done) => setTimeout(done, delay));
    }
    // execute actions
    let actions = await yaraSource(await page.content());
    if (webpage.option.actions) {
      actions = webpage.option.actions;
    }
    if (actions && actions.length > 0) {
      logger.debug(actions);
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
        logger.debug(`action: ${action}, target: ${target}`);
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
    logger.error(err);
    webpage.error = err.message;
  }
  logger.debug(`goto completed.`);

  try {
    webpage.url = page.url();
    logger.debug(webpage.url);
    webpage.title = await page.title();
    logger.debug(webpage.title);
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
    logger.error(err);
    if (!webpage.error) {
      webpage.error = err.message;
    }
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
    logger.debug(`webpage saved: ${webpage._id}`);
  } catch (err) {
    logger.error(err);
  }
  return webpage._id;
}

export default playwget;
