// patchright here!
import { BrowserContext, Page, chromium } from 'patchright';
import Jimp from 'jimp';
import * as path from 'node:path';
import * as fs from 'fs';

async function pptrEventSet(
  browserContext: BrowserContext,
  page: Page,
): Promise<void> {
  const browser = browserContext.browser();
  if (browser) {
    browser.on('disconnected', () => console.log('browser disconnected'));
  }
  browserContext.on('close', () => console.log('browserContext closed'));

  page.on('request', (request: any) => {
    //console.log("Request:", request.url());
  });
  page.on('requestfinished', async (request: any) => {
    const res = await request.response();
    //console.log("Finished:", res.url());
  });
  page.on('requestfailed', (request: any) => {
    console.log('Failed:', request.url() + ' ' + request.failure().errorText);
  });
  page.on('close', () => {
    console.log('Page closed');
  });
  page.on('crash', () => {
    console.log('Page crashed');
  });
  page.on('dialog', (dialog) => dialog.dismiss());
  page.on('load', () => {
    console.log('Page loaded');
  });
  page.on('domcontentloaded', () => {
    console.log('DOM content loaded');
  });
  page.on('download', (data) => {
    console.log('Download started:', data);
  });
  // Log all uncaught errors to the terminal
  page.on('pageerror', (exception) => {
    console.log(`Uncaught exception: "${exception}"`);
  });
}

async function genPage(dataDir: string): Promise<{
  page: Page;
  browserContext: BrowserContext;
}> {
  const browserContext = await chromium.launchPersistentContext(dataDir, {
    channel: 'chrome',
    headless: true,
    viewport: null,
    recordHar: { path: `${dataDir}/pw.har.zip` },
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
}

async function imgResize(buffer: Buffer): Promise<Buffer> {
  const res = await Jimp.read(buffer);
  if (res.getWidth() > 240) {
    res.resize(240, Jimp.AUTO);
  }
  return res.getBufferAsync(Jimp.MIME_PNG);
}

async function playwget() {
  try {
    const dataDir = '../data/pw';
    const { page, browserContext } = await genPage(dataDir);
    //const browser = browserContext.browser();

    await page.goto('https://www.google.com', {
      timeout: 60000,
      waitUntil: 'load',
    });

    const delay = 5;
    console.log('Waiting for ' + delay + 'seconds');
    await new Promise((done) => setTimeout(done, delay * 1000));
    console.log('delay done');

    let webpage: any = {};
    webpage.url = page.url();
    webpage.title = await page.title();
    webpage.content = await page.content();
    let screenshot = await page.screenshot({
      fullPage: false,
      timeout: 10000,
    });
    const resizedImg = await imgResize(screenshot);
    webpage.thumbnail = resizedImg.toString('base64');
    let fullscreenshot = await page.screenshot({
      fullPage: true,
      timeout: 10000,
    });
    //console.log(webpage);
    // Waits for all the reported 'request' events to resolve.
    await page.removeAllListeners();
    await browserContext.removeAllListeners();
    await page.close();

    await browserContext.close();
    console.log('bar');

    await new Promise((done) => setTimeout(done, delay * 1000));
    return webpage;
  } catch (e) {
    console.log(e);
  }
  return;
}

(async () => {
  console.log('wget start');
  const webpage = await playwget();
  console.log('wget done');
  const har = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../data/pw/pw.har'), 'utf-8'),
  );
  const entries = har.log.entries;
  for (const entry of entries) {
    const request = entry.request;
    const response = entry.response;
    console.log(request, response.headers);
  }
})();
