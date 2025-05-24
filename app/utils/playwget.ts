// patchright here!
import { BrowserContext, Page, chromium } from 'patchright';
import Jimp from 'jimp';
import * as path from 'node:path';
import * as fs from 'fs';

import WebpageModel from '../models/webpage';
import logger from './logger';
import findProc from 'find-process';
import crypto from 'crypto';
import ScreenshotModel from '../models/screenshot';
import savePayload from './playwgetSave';
import mongoose from 'mongoose';

async function pptrEventSet(
  browserContext: BrowserContext,
  page: Page,
): Promise<void> {
  const browser = browserContext.browser();
  if (browser) {
    browser.on('disconnected', () => logger.debug('browser disconnected'));
  }
  browserContext.on('close', () => logger.debug('browserContext closed'));

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
  page.on('close', () => {
    logger.debug('Page closed');
  });
  page.on('crash', () => {
    console.log('Page crashed');
  });
  page.on('dialog', (dialog) => dialog.dismiss());
  page.on('load', () => {
    logger.debug('Page loaded');
  });
  page.on('domcontentloaded', () => {
    logger.debug('DOM content loaded');
  });
  page.on('download', async (data) => {
    console.log('Download started:', data.url());
    const read = await data.createReadStream();
    read.on('data', (chunk) => {
      logger.debug(`Received ${chunk.length} bytes of data.`);
    });
    //await savePayload(read);
  });
  // Log all uncaught errors to the terminal
  page.on('pageerror', (exception) => {
    logger.error(`Uncaught exception: "${exception}"`);
  });
}

async function genPage(webpage: any): Promise<{
  page: Page;
  browserContext: BrowserContext;
}> {
  const dataDir = `/tmp/${webpage._id}`;
  logger.debug(`${dataDir}`);
  try {
    const browserContext = await chromium.launchPersistentContext(dataDir, {
      channel: 'chrome',
      headless: false,
      viewport: null,
      recordHar: { path: `${dataDir}/pw.har` },
      ignoreHTTPSErrors: true,
      //args: chromiumArgs,
      // do NOT add custom browser headers or userAgent
    });
    const permissions = ['storage-access'];
    await browserContext.grantPermissions(permissions);
    //browserContext.setDefaultTimeout(30000);
    const page = await browserContext.newPage();
    await pptrEventSet(browserContext, page);
    return {
      page: page as Page,
      browserContext: browserContext as BrowserContext,
    };
  } catch (err) {
    logger.error(err);
  }
  return { page: null as any, browserContext: null as any };
}

async function imgResize(buffer: Buffer): Promise<Buffer> {
  const res = await Jimp.read(buffer);
  if (res.getWidth() > 240) {
    res.resize(240, Jimp.AUTO);
  }
  return res.getBufferAsync(Jimp.MIME_PNG);
}

async function saveFullscreenshot(buff: Buffer): Promise<string | undefined> {
  try {
    const md5Hash = crypto.createHash('md5').update(buff).digest('hex');
    const fullscreenshot = buff.toString('base64');
    let ss: any = await ScreenshotModel.findOneAndUpdate(
      { md5: md5Hash },
      { screenshot: fullscreenshot },
      { new: true, upsert: true },
    ).exec();

    if (ss) {
      return ss._id.toString();
    } else {
      logger.warn('Screenshot not saved.');
      return undefined;
    }
  } catch (err: any) {
    logger.error(err);
    return undefined;
  }
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
  const chromiumArgs = [
    '--window-size=1280,720',
    '--start-maximized',
    '--disable-gpu',
  ];
  if (webpage.option?.proxy) {
    if (
      webpage.option.proxy.match(/^\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}:\d{1,5}$/)
    ) {
      chromiumArgs.push(`--proxy-server=${webpage.option.proxy}`);
    }
  }
  logger.debug(webpage.option);

  const { page, browserContext } = await genPage(webpage);
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
  await page.setViewportSize({ width: 1280, height: 720 });

  try {
    await page.goto(webpage.input, {
      timeout: webpage.option.timeout * 1000,
      referer: webpage.option.referer,
      waitUntil: 'load',
    });
    await new Promise((done) => setTimeout(done, webpage.option.delay * 1000));
  } catch (err: any) {
    logger.error(err);
    webpage.error = err.message;
  }
  logger.debug(`goto completed.`);

  if (webpage.option.click) {
  }

  try {
    webpage.url = page.url();
    webpage.title = await page.title();
    webpage.content = await page.content();
    let screenshot = await page.screenshot({
      fullPage: false,
      timeout: webpage.option.delay * 1000,
    });
    const resizedImg = await imgResize(screenshot);
    webpage.thumbnail = resizedImg.toString('base64');
    let fullscreenshot = await page.screenshot({
      fullPage: true,
      timeout: webpage.option.delay * 1000,
    });
    let fss = await saveFullscreenshot(fullscreenshot);
    if (fss) {
      webpage.screenshot = fss;
    }
  } catch (err: any) {
    logger.error(err);
    if (!webpage.error) {
      webpage.error = err.message;
    }
  }
  await webpage.save();
  // Waits for all the reported 'request' events to resolve.
  page.removeAllListeners();
  await page.close();

  browserContext.clearPermissions();
  await browserContext.clearCookies();
  //browserContext.removeAllListeners();
  const browser = browserContext.browser();
  await browserContext.close();
  await browser?.close();
  return webpage._id;
}

export default playwget;
