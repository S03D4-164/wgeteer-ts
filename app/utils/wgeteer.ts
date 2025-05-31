import WebpageModel from '../models/webpage';
import RequestModel from '../models/request';
import ResponseModel from '../models/response';

import puppeteer from './puppeteer';
import antibotbrowser from './antibotbrowser';
import { getHostInfo } from './ipInfo';
import logger from './logger';
import { db, closeDB } from './database';
import { saveRequest, saveResponse } from './wgeteerSave';
import { saveFullscreenshot } from './screenshot';

import { Browser, CDPSession, Page, Target } from 'puppeteer';
import mongoose from 'mongoose';
import { connect } from 'puppeteer-real-browser';
import findProc from 'find-process';
import Jimp from 'jimp';

async function pptrEventSet(
  client: CDPSession,
  browser: Browser,
  page: Page,
): Promise<void> {
  /*
  client.on("Network.requestWillBeSent", async ({ requestId, request }) => {
    logger.debug("[requestWillBeSent]", requestId);
    const req = await new Request({
      devtoolsReqId: requestId,
      webpage: pageId,
    });
    await req.save();
  });

  client.on("Network.responseReceived", async ({ requestId, response }) => {
    logger.debug("[responseReceived]", requestId);
    const res = await new Response({
      devtoolsReqId: requestId,
      webpage: pageId,
    });
    await res.save();
  });

  client.on(
    "Network.loadingFinished",
    async ({ requestId, encodedDataLength }) => {
      const response = await client.send("Network.getResponseBody", {
        requestId,
      });
      if (response.body) {
        logger.debug(
          "[loadingFinished]",
          requestId,
          encodedDataLength,
          response.body.length,
          response.base64Encoded,
        );
      } else {
        logger.debug(
          "[loadingFinished] no body",
          requestId,
          encodedDataLength,
          response.body,
          response.base64Encoded,
        );
      }
    },
  );

  client.on(
    "Network.loadingFailed",
    async ({ requestId, encodedDataLength }) => {
      const response = await client.send("Network.getResponseBody", {
        requestId,
      });
      if (response.body) {
        logger.debug(
          "[loadingFinished]",
          requestId,
          encodedDataLength,
          response.body.length,
          response.base64Encoded,
        );
      } else {
        logger.debug(
          "[loadingFinished] no body",
          requestId,
          encodedDataLength,
          response.body,
          response.base64Encoded,
        );
      }
    },
  );

  client.on("Network.dataReceived", async ({ requestId, dataLength }) => {
    logger.debug(`[dataReceived] ${requestId} ${dataLength}`);
  });

  browser.on("targetchanged", async (tgt) =>
    console.log("[Browser] taget changed: ", tgt),
  );
  browser.on("targetcreated", async (tgt) =>
    console.log("[Browser] taget created: ", tgt),
  );
  browser.on("targetdestroyed", async (tgt) =>
    console.log("[Browser taget destroyed: ", tgt),
  );

  page.on("frameattached", (frm) => console.log("[Frame] attached: ", frm));
  page.on("framedetached", (frm) => console.log("[Frame] detached: ", frm));
  page.on("framenavigateed", (frm) => console.log("[Frame] navigated: ", frm));

  page.on('dialog', async (dialog) => {
    console.log('[Page] dialog: ', dialog.type(), dialog.message());
    await dialog.dismiss();
  });
  page.on('console', async (msg) => {
    console.log('[Page] console: ', msg.type(), msg.text());
  });
  page.on('error', async (err) => {
    console.log('[Page] error: ', err);
  });
  page.on('pageerror', async (perr) => {
    console.log('[Page] page error: ', perr);
  });

  page.on('workercreated', (wrkr) => console.log('[Worker] created: ', wrkr));
  page.on('workerdestroyed', (wrkr) => console.log('[Worker] destroyed: ', wrkr));
  */

  page.on('request', async (interceptedRequest) => {
    try {
      console.log(
        '[Request] ',
        //interceptedRequest,
        //interceptedRequest._requestId,
        interceptedRequest.method(),
        interceptedRequest.resourceType(),
        interceptedRequest.url().slice(0, 100),
      );
    } catch (error) {
      console.log(error);
    }
  });

  page.on('response', async (interceptedResponse) => {
    try {
      console.log(
        '[Response] ',
        interceptedResponse.status(),
        interceptedResponse.remoteAddress(),
        interceptedResponse.url().slice(0, 100),
      );
    } catch (error) {
      console.log(error);
    }
  });
}

async function wget(pageId: string): Promise<string | undefined> {
  let webpage: any;
  try {
    webpage = await WebpageModel.findById(pageId).exec();
  } catch (err) {
    console.log(err);
    logger.error(err);
    return;
  }

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
    console.log(err);
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
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--window-size=1280,720',
    '--start-maximized',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--disable-features=BlockInsecurePrivateNetworkRequests',
    '--devtools-flags=disable',
    '--disable-features=IsolateOrigins',
    /* Detected as a bot. Do not use.
     * '--disable-site-isolation-trials',
     */
    //`--disable-extensions-except=${pathToExtension}`,
    //`--load-extension=${pathToExtension}`,
    //'--enable-logging=stderr','--v=1',
  ];

  if (webpage.option?.proxy) {
    if (
      webpage.option.proxy.match(/^\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}:\d{1,5}$/)
    ) {
      chromiumArgs.push(`--proxy-server=${webpage.option.proxy}`);
    }
  }
  logger.debug(webpage.option);

  const executablePath = '/usr/bin/google-chrome-stable';
  const product = 'chrome';

  async function genPage(): Promise<{
    page: Page;
    browser: Browser;
    setTarget: any;
  }> {
    try {
      if (webpage.option?.pptr === 'firefox') {
        console.log(executablePath);
        const browser = await puppeteer.launch({
          product: 'firefox',
          //executablePath: executablePath,
        });
        const page = await browser.newPage();
        let setTarget: any;
        return { page: page as Page, browser, setTarget };
      } else if (webpage.option?.pptr === 'real') {
        process.env.CHROME_PATH = executablePath;
        const { page: connectedPage, browser: connectedBrowser } =
          await connect({
            headless: false,
            args: chromiumArgs,
            //tf: true,
            turnstile: true,
          });
        const page = connectedPage as any;
        const browser = connectedBrowser as any;
        await page.setViewport({
          width: 1280,
          height: 720,
        });
        return { page, browser, setTarget };
      } else if (webpage.option?.pptr === 'antibot') {
        const antibrowser = await antibotbrowser.startbrowser(
          9515,
          webpage.input,
        );
        console.log(antibrowser);
        const opt = {
          browserWSEndpoint: antibrowser.websocket,
        };
        console.log(opt);
        const browser = await puppeteer.connect(opt);
        const page = await browser.newPage();
        let setTarget: any;
        return { page, browser, setTarget };
      } else {
        const browser = await puppeteer.launch({
          executablePath: executablePath,
          headless: true,
          //headless: false,
          ignoreHTTPSErrors: true,
          //defaultViewport: { width: 1280, height: 720 },
          defaultViewport: null,
          dumpio: false,
          args: chromiumArgs,
          product: product,
          ignoreDefaultArgs: ['--enable-automation'],
          userDataDir: `/tmp/${webpage._id}`,
          //protocolTimeout: webpage.option.timeout * 1000,
          /*targetFilter: (target) => {
            target.type() !== "other" || !!target.url();
          },*/
        });
        /*
        const browserContext = await browser.defaultContext();
        const browserPages = await browserContext.pages();
        const page = browserPages.length > 0 ? browserPages[0] : await browserContext.newPage();
        const page = (await browser.pages())[0];
        */
        const page = await browser.newPage();
        let setTarget: any;
        return { page, browser, setTarget };
      }
    } catch (err: any) {
      console.log(err);
      logger.error(err);
      throw err; // Re-throw the error to be caught in the outer scope
    }
  }

  let page: Page, browser: Browser, setTarget: any;
  try {
    ({ page, browser, setTarget } = await genPage());
    const browserVersion = await browser.version();
    const browserProc = browser.process();
    logger.debug(
      `${browserVersion}, ${browserProc?.pid}, ${page}, ${setTarget}`,
    );
  } catch (error: any) {
    logger.error(error);
    webpage.error = error.message;
    await webpage.save();
    return webpage._id;
  }

  browser.once('disconnected', () => logger.info('[Browser] disconnected.'));

  if (product === 'chrome') {
    if (webpage.option?.userAgent && webpage.option.userAgent.length > 1) {
      await page.setUserAgent(webpage.option.userAgent);
    }
    if (webpage.option?.disableScript) {
      await page.setJavaScriptEnabled(false);
    } else {
      await page.setJavaScriptEnabled(true);
    }
    if (exHeaders) {
      await page.setExtraHTTPHeaders(exHeaders);
    }
    /* Detected as a bot. Do not use.
     * await page.setBypassCSP(true);
     */
  }

  let responseCache: any[] = [];
  let requestArray: any[] = [];
  let responseArray: any[] = [];

  let client: CDPSession | null = null;
  try {
    client = await page.target().createCDPSession();
    await pptrEventSet(client, browser, page);
    await client.send('Network.enable');

    if (product === 'chrome') {
      await client.send('Network.setRequestInterception', {
        patterns: ['*'].map((pattern) => ({
          urlPattern: pattern,
          interceptionStage: 'HeadersReceived',
        })),
      });
    }

    client.on(
      'Network.requestIntercepted',
      async ({ interceptionId, request, responseStatusCode }) => {
        //console.log(`[Intercepted] ${requestId}, ${responseStatusCode}, ${isDownload}, ${request.url}`);
        try {
          if (client) {
            let response = await client.send(
              'Network.getResponseBodyForInterception',
              { interceptionId },
            );
            /*
        console.log(
          "[Intercepted]",
          //requestId,
          response.body.length,
          response.base64Encoded,
        );
        */
            let newBody = (response as { body: string; base64Encoded: boolean })
              .base64Encoded
              ? Buffer.from(
                  (response as { body: string; base64Encoded: boolean }).body,
                  'base64',
                )
              : (response as { body: string; base64Encoded: boolean }).body;
            let cache = {
              url: request.url,
              body: newBody,
              interceptionId: interceptionId,
            };
            responseCache.push(cache);
          }
          responseCache.push({});
        } catch (err: any) {
          if (err.message) {
            logger.debug(
              `[Intercepted] ${err.message} ${responseStatusCode} ${request.url}`,
            );
          }
          //console.log("[Intercepted] error", err);
        }

        try {
          if (client)
            await client.send('Network.continueInterceptedRequest', {
              interceptionId,
            });
          //console.log(`Continuing interception ${interceptionId}`)
        } catch (err: any) {
          logger.debug(err);
        }
      },
    );
  } catch (err: any) {
    logger.error('[client]', err);
    webpage.error = err.message;
  }

  page.once('load', () => logger.info('[Page] loaded'));
  page.once('domcontentloaded', () => logger.info('[Page] DOM content loaded'));
  //page.once('closed', () => logger.info('[Page] closed'));

  async function docToArray(request: any): Promise<void> {
    try {
      //logger.debug('[Request] finished: ' + request.method() +request.url().slice(0,100));
      let req: any = await saveRequest(request, pageId);
      const response = await request.response();
      let res;
      if (response) {
        res = await saveResponse(response, pageId, responseCache);
        if (res && responseArray != null) {
          responseArray.push(res);
        }
        req.interceptionId = res?.interceptionId;
      }
      if (req && requestArray != null) {
        requestArray.push(req);
      }
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
    } catch (error: any) {
      //logger.error(error);
      console.log(error);
    }
  }

  page.on('requestfailed', async function (request) {
    console.log(
      '[Request] failed: ',
      request.url().slice(0, 100),
      request.failure(),
      //request.failure().errorText,
    );
    await docToArray(request);
  });

  page.on('requestfinished', async function (request) {
    await docToArray(request);
  });

  page.on('dialog', async (dialog) => {
    logger.debug('[Page] dialog: ', dialog.type(), dialog.message());
    await dialog.dismiss();
  });

  try {
    await page.goto(webpage.input, {
      timeout: webpage.option.timeout * 1000,
      referer: webpage.option.referer,
      waitUntil: 'load',
    });
    await new Promise((done) => setTimeout(done, webpage.option.delay * 1000));

    // click cloudflare checkbox
    if (webpage.option.cf) {
      const selector = '.spacer > div > div';
      const info = await page.evaluate((selector) => {
        const el: any = document.querySelector(selector);
        let zoom = 1.0;
        for (let e = el; e != null; e = e.parentElement) {
          if (e.style.zoom) {
            zoom *= parseFloat(e.style.zoom);
          }
        }
        const rect = el.getBoundingClientRect();
        return {
          height: rect.height,
          width: rect.width,
          x: rect.left,
          y: rect.top,
          zoom: zoom,
        };
      }, selector);
      //console.log(info);
      const center_height = info.height / 2;
      //const center_width = info.width / 2;
      const click_x = (info.x + center_height) * info.zoom;
      const click_y = (info.y + center_height) * info.zoom;
      console.log(
        'move: %s(%s) => (%s,%s)',
        selector,
        JSON.stringify(info),
        click_x,
        click_y,
      );
      //await page.mouse.move(click_x, click_y, { steps: 1 });
      await page.mouse.click(click_x, click_y);

      await new Promise((done) =>
        setTimeout(done, webpage.option.delay * 1000),
      );
    }
  } catch (err: any) {
    //logger.info(err);
    console.log(err);
    webpage.error = err.message;
    //await page._client.send("Page.stopLoading");
  }

  logger.debug(
    `goto completed. ${requestArray.length}, ${responseArray.length}`,
  );

  try {
    webpage.url = page.url();
    if (responseArray.length > 0) {
      webpage.title = await page.title();
      webpage.content = await page.content();
    }
    let screenshot = await page.screenshot({
      fullPage: false,
      encoding: 'base64',
    });

    async function imgResize(data: string): Promise<Buffer> {
      const buffer = Buffer.from(data, 'base64');
      const res = await Jimp.read(buffer);
      if (res.getWidth() > 240) {
        res.resize(240, Jimp.AUTO);
      }
      return res.getBufferAsync(Jimp.MIME_PNG);
    }

    const resizedImg = await imgResize(screenshot);
    webpage.thumbnail = resizedImg.toString('base64');

    let fullscreenshot = await page.screenshot({
      fullPage: true,
      encoding: 'base64',
    });

    let fss = await saveFullscreenshot(fullscreenshot);
    if (fss) {
      webpage.screenshot = fss;
    }
  } catch (error: any) {
    //logger.info(error);
    console.log(error);
    if (!webpage.error) {
      webpage.error = error.message;
    }
    await new Promise((done) => setTimeout(done, webpage.option.delay * 1000));
  }

  logger.debug(
    `[finished] ${requestArray.length}, ${responseArray.length}, ${webpage.url}`,
  );
  await webpage.save();
  /*
  await new Promise((done) =>
    setTimeout(done, webpage.option.delay * 1000 * 4),
  );
  */
  let requests;
  try {
    requests = await RequestModel.insertMany(requestArray, { ordered: false });
  } catch (err: any) {
    console.log('[Request]', err);
    logger.error(err);
  }

  let responses: any[] = [];
  try {
    responses = await ResponseModel.insertMany(responseArray, {
      ordered: false,
      //rawResult: true,
    });
  } catch (err: any) {
    console.log('[Response]', err);
    logger.error(err);
  }
  if (responses.length == 0) {
    for (let res of responseArray) {
      try {
        const newRes = new ResponseModel(res);
        await newRes.save();
        responses.push(newRes);
      } catch (err) {
        console.log('[Response]', err);
        logger.error(err);
      }
    }
  }

  let finalResponse: any;
  try {
    if (requests && responses) {
      for (const res of responses) {
        for (const req of requests) {
          //console.log(req.interceptionId, res.interceptionId);
          if (res.interceptionId === req.interceptionId) {
            res.request = req;
            req.response = res;
            break;
          }
        }
      }
    }
    if (requests) {
      await RequestModel.bulkSave(requests, { ordered: false });
      webpage.requests = requests;
    }
    if (responses) {
      await ResponseModel.bulkSave(responses, { ordered: false });
      webpage.responses = responses;

      if (webpage.url) {
        for (const res of responses) {
          if (res.url && res.url === webpage.url) {
            finalResponse = res;
            break;
          }
        }
      }

      if (!finalResponse) {
        if (responses.length === 1) {
          finalResponse = responses[0];
          webpage.url = finalResponse.url;
        }
      }
    }
    if (finalResponse) {
      if (webpage.error && finalResponse.status) {
        webpage.error = undefined;
      }
      webpage.status = finalResponse.status;
      webpage.headers = finalResponse.headers;
      webpage.remoteAddress = finalResponse.remoteAddress;
      webpage.securityDetails = finalResponse.securityDetails;
      //console.log(webpage.status, webpage.error);
      if (webpage.remoteAddress?.ip) {
        console.log(webpage.remoteAddress);
        let hostinfo = await getHostInfo(webpage.remoteAddress.ip);
        if (hostinfo) {
          if (hostinfo.reverse) {
            webpage.remoteAddress.reverse = hostinfo.reverse;
          }
          if (hostinfo.bgp) {
            webpage.remoteAddress.bgp = hostinfo.bgp;
          }
          if (hostinfo.geoip) {
            webpage.remoteAddress.geoip = hostinfo.geoip;
          }
          if (hostinfo.ip) {
            webpage.remoteAddress.ip = hostinfo.ip;
          }
        }
      }
    }
    const cookies = await page.cookies();
    let headers = finalResponse?.headers || {};
    for (const head in headers) {
      if (typeof headers[head] === 'string') {
        headers[head] = headers[head].split(';');
      }
    }
    //console.log(cookies, headers);
    /*
    const wapalyzed = await wapalyze(
      webpage.url,
      headers,
      webpage.content,
      cookies,
    );
    let wapps: string[] = [];
    for (const wap of wapalyzed) {
      wapps.push(wap.name);
    }
    console.log(wapps);
    if (wapps) {
      webpage.wappalyzer = wapps;
    }
    */
    await webpage.save();

    //ss = null;
    if (responses) {
      //ipInfo.setResponseIp(responses);
    }

    /*
    await client.send("Network.disable");
    client.removeAllListeners();
    client = null;
    */

    page.removeAllListeners();

    //console.log(requestArray.length, responseArray.length);

    if (client) {
      await client.detach();
    }

    await browser.close();
    await closeDB(db);
  } catch (err: any) {
    console.log(err);
    logger.error(err);
  }
  return pageId;
}

export { wget };
