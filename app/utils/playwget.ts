//import { BrowserContext, Page, chromium } from 'patchright';
import { BrowserContext, Page, chromium } from 'rebrowser-playwright-core';
//process.env.REBROWSER_PATCHES_DEBUG = '1';
process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = 'addBinding';
import { protectIt } from './playwright-afp';

import WebpageModel from '../models/webpage';
import RequestModel from '../models/request';
import ResponseModel from '../models/response';

import logger from './logger';
import { saveRequest, saveResponse } from './playwgetIntercept';
import {
  cdpScreenshot,
  imgResize,
  saveFullscreenshot,
} from './playwgetScreenshot';

import mongoose from 'mongoose';
import checkTurnstile from './turnstile';

import explainCode from './gemini';
//import flexDoc from './flexsearch';
import fs from 'fs';
import { execSync } from 'child_process';
import { Xvfb } from './node-xvfb';
import { spawn } from 'node:child_process';
import cleanup from './playwgetCleanup';
import { playwgetAction } from './playwgetAction';
import pptrEventSet from './playwgetEvent';
import { EventEmitter } from 'events';
import { setResponseIps } from './ipInfo';

const dataDir = '/tmp/ppengo';

async function genPage(
  webpage: any,
  chromiumArgs: any,
): Promise<{
  page: Page;
  browserContext: BrowserContext;
}> {
  const pageId = webpage._id;
  const userDataDir = `${dataDir}/${pageId}`;
  //logger.debug(`${userDataDir}`);
  let options: any = {
    executablePath: process.env.CHROME_EXECUTABLE_PATH,
    //executablePath: '/usr/bin/google-chrome-stable',
    channel: 'chrome',
    headless: false,
    viewport: null,
    ignoreHTTPSErrors: true,
    args: chromiumArgs,
    ignoreDefaultArgs: ['--enable-automation'], // hide infobar
    javaScriptEnabled: true,
    timezoneId: 'Asia/Tokyo',
  };

  // saveHarfile オプションがある場合のみ HARファイルを記録
  if (webpage.option?.saveHarfile) {
    options.recordHar = { path: `${userDataDir}/pw.har` };
  }
  let exHeaders: Record<string, string> = {};
  if (webpage.option?.lang) {
    exHeaders['Accept-Language'] = webpage.option.lang;
  }
  if (webpage.option?.userAgent && webpage.option.userAgent.length > 1) {
    options.userAgent = webpage.option.userAgent;
  }
  if (webpage.option?.disableScript) {
    options.javaScriptEnabled = false;
  }
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
    const browserContext = await chromium.launchPersistentContext(
      userDataDir,
      options,
    );
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
    logger.error(`[${pageId}] ${err}`);
  }
  return { page: null as any, browserContext: null as any };
}

async function playwget(pageId: string): Promise<string | undefined> {
  logger.debug(`[${pageId}] playwget start`);

  // リトライ時に前のプロセスが残っている可能性があるので、事前に強制クリーンアップ
  try {
    await cleanup(pageId, undefined);
    await new Promise((done) => setTimeout(done, 500));
  } catch (err) {
    logger.error(`[${pageId}] pre-cleanup failed: ${err}`);
  }

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
  //await cleanup(pageId, undefined);

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

  // xvfb は常に起動（Playwright headless mode 使用時のため）
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
  await new Promise((done) => setTimeout(done, 5000));

  const fluxbox = spawn(
    '/usr/bin/fluxbox',
    ['-display', `:${displayNum}`, '-screen', '0'],
    { detached: true, timeout: 5 * 60 * 1000 },
  );
  await new Promise((done) => setTimeout(done, 5000));

  await fs.promises.mkdir(`${dataDir}/${webpage._id}`, { recursive: true });
  await fs.promises.writeFile(
    `${dataDir}/${webpage._id}/displayNum`,
    displayNum,
  );

  let { page, browserContext } = await genPage(webpage, chromiumArgs);

  if (!page || !browserContext) {
    logger.error(`[${pageId}] Failed to create page or browser context`);
    return;
  }
  //const browser = browserContext.browser();

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
  let wsObj: any = {};

  // websocket
  await client.send('Network.enable');
  client.on('Network.webSocketClosed', async (ws) => {
    console.log('closed', ws);
  });
  client.on('Network.webSocketCreated', async (ws) => {
    //console.log('created', wsObj);
    wsObj[ws.requestId] = {
      url: ws.url,
      request: {},
      response: {},
      messages: [],
    };
  });
  client.on('Network.webSocketFrameError', async (ws) => {
    //console.log('error', ws);
    wsObj[ws.requestId]['response'] = {};
    wsObj[ws.requestId]['messages'].push(ws.errorMessage);
    await wsObjToArray(wsObj[ws.requestId], ws.requestId);
  });
  client.on('Network.webSocketFrameReceived', async (ws) => {
    //console.log('received', ws);
    let msg = {
      frame: 'received',
      ...ws,
    };
    wsObj[ws.requestId]['messages'].push(msg);
  });
  client.on('Network.webSocketFrameSent', async (ws) => {
    //console.log('sent', ws);
    let msg = {
      frame: 'sent',
      ...ws,
    };
    wsObj[ws.requestId]['messages'].push(msg);
  });
  client.on('Network.webSocketHandshakeResponseReceived', async (ws) => {
    //console.log('response', ws);
    wsObj[ws.requestId]['response'] = ws.response;
    await wsObjToArray(wsObj[ws.requestId], ws.requestId);
  });
  client.on('Network.webSocketWillSendHandshakeRequest', async (ws) => {
    //console.log('request', ws);
    wsObj[ws.requestId]['request'] = ws.request;
  });

  async function wsObjToArray(ws: any, interceptionId: String) {
    //console.log(ws);
    try {
      const req = {
        webpage: pageId,
        url: ws.url,
        headers: ws.request?.headers,
        interceptionId,
      };
      const res = {
        webpage: pageId,
        url: ws.url,
        status: ws.response?.status,
        statusText: ws.response?.statusText,
        headers: ws.response?.headers,
        interceptionId,
      };
      if (res && responseArray != null) {
        responseArray.push(res);
      }
      if (req && requestArray != null) {
        requestArray.push(req);
      }
    } catch (error: any) {
      logger.error(error);
    }
  }

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
          responseArray.push(res);
        }
        req.interceptionId = res?.interceptionId;
      }
      if (req && requestArray != null) {
        requestArray.push(req);
      }
    } catch (error: any) {
      logger.error(error);
    }
  }
  /*

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

    /*
    try 
      const { root } = await client.send('DOM.getDocument');
      const { nodeId } = await client.send('DOM.querySelector', {
        nodeId: root.nodeId,
        selector: 'html',
      });
      await client.send('CSS.enable');
      const { fonts } = await client.send('CSS.getPlatformFontsForNode', {
        nodeId: nodeId,
      });
      //console.log(fonts);
    } catch (err: any) {
      logger.debug(
        `[${pageId}] DOM/CSS analysis failed (non-fatal): ${err.message}`,
      );
      // DOM/CSS 取得失敗は continue（不要な情報取得なので無視）
    }
    */
    await playwgetAction(page, webpage, client);
    //await page.evaluate(() => window.stop());
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
    // ページが閉じられていないか確認
    if (page.isClosed()) {
      logger.error(`[${pageId}] Page is closed after goto`);
      return;
    }

    webpage.url = page.url();
    logger.debug(`[${pageId}] ${webpage.url}`);

    try {
      webpage.title = await page.title();
      logger.debug(`[${pageId}] ${webpage.title}`);
    } catch (titleErr: any) {
      logger.warn(`[${pageId}] Failed to get title: ${titleErr.message}`);
      webpage.title = '';
    }

    try {
      webpage.content = await page.content();
    } catch (contentErr: any) {
      logger.warn(`[${pageId}] Failed to get content: ${contentErr.message}`);
      webpage.content = '';
    }

    const screenshot = await cdpScreenshot(client);
    const resizedImg = await imgResize(screenshot);
    webpage.thumbnail = resizedImg.toString('base64');
    let fss = await saveFullscreenshot(screenshot, []);
    if (fss) {
      webpage.screenshot = new mongoose.Types.ObjectId(fss);
    }

    // captureDisplay オプションがある場合のみ xwd でスクリーンショット取得
    if (webpage.option?.captureDisplay) {
      const pngPath = `${dataDir}/${pageId}/screenshot.png`;
      try {
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
      } catch (err) {
        logger.error(`[${pageId}] xwd screenshot failed: ${err}`);
      }
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
      // saveLimit を取得（デフォルトは100）
      const saveLimit = webpage.option?.saveLimit || 100;
      const limitedRequestArray = requestArray.slice(0, saveLimit);

      let start = new Date();
      logger.debug(
        `[${pageId}] request save: ${limitedRequestArray.length} (total: ${requestArray.length})`,
      );
      //console.log(requestArray);
      requests = await RequestModel.insertMany(limitedRequestArray, {
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

  // convert websocket messages to text
  let tmpArray = [];
  for (let res of responseArray) {
    Object.entries(wsObj).forEach(([key, value]: any) => {
      if (res.interceptionId == key) {
        console.log(key, value);
        res.text = JSON.stringify(value['messages'], null, 2);
      }
    });
    //console.log(res);
    tmpArray.push(res);
  }
  responseArray = tmpArray;

  let responses = (await ResponseModel.find({ webpage })) || [];
  if (responses.length == 0) {
    // saveLimit を取得（デフォルトは100）
    const saveLimit = webpage.option?.saveLimit || 100;
    let limitedResponseArray = responseArray.slice(0, saveLimit);
    limitedResponseArray = await setResponseIps(limitedResponseArray);
    if (webpage.option.bulksave) {
      try {
        let start = new Date();
        logger.debug(
          `[${pageId}] response bulk save: ${limitedResponseArray.length} (total: ${responseArray.length})`,
        );
        responses = await ResponseModel.insertMany(limitedResponseArray, {
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
    const saveLimit = webpage.option?.saveLimit || 100;
    const limitedResponseArray = responseArray.slice(0, saveLimit);

    logger.debug(
      `[${pageId}] response save: ${limitedResponseArray.length} (total: ${responseArray.length})`,
    );
    for (let res of limitedResponseArray) {
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

    // リスナーを削除してからクローズ（pending リクエスト処理を防止）
    page.removeAllListeners('requestfailed');
    page.removeAllListeners('requestfinished');
    page.removeAllListeners('load');
    page.removeAllListeners('domcontentloaded');
    page.removeAllListeners('dialog');

    // CDPセッションもリスナー削除
    try {
      (client as unknown as EventEmitter).removeAllListeners();
    } catch (err) {
      logger.debug(`[${pageId}] client.removeAllListeners() failed: ${err}`);
    }

    const browser = browserContext.browser();

    try {
      await browserContext.close();
      await new Promise((done) => setTimeout(done, 500));
    } catch (err) {
      logger.error(`[${pageId}] browserContext.close() failed: ${err}`);
    }

    try {
      await browser?.close();
      await new Promise((done) => setTimeout(done, 500));
    } catch (err) {
      logger.error(`[${pageId}] browser.close() failed: ${err}`);
    }

    try {
      xvfb.stopSync();
    } catch (err) {
      logger.error(`[${pageId}] xvfb.stopSync() failed: ${err}`);
    }

    // 強制クリーンアップ：残っているプロセスを確実に殺す
    try {
      await cleanup(pageId, displayNum);
    } catch (err) {
      logger.error(`[${pageId}] cleanup failed: ${err}`);
    }

    logger.debug(`[${pageId}] webpage saved`);
    return pageId;
  } catch (err) {
    logger.error(`[${pageId}] ${err}`);
    // エラー時も必ずリスナーを削除してからクリーンアップ
    try {
      page.removeAllListeners('requestfailed');
      page.removeAllListeners('requestfinished');
      page.removeAllListeners('load');
      page.removeAllListeners('domcontentloaded');
      page.removeAllListeners('dialog');

      // CDPセッションもリスナー削除
      try {
        (client as unknown as EventEmitter).removeAllListeners();
      } catch (err) {
        logger.debug(
          `[${pageId}] client.removeAllListeners() in error handler failed: ${err}`,
        );
      }

      await cleanup(pageId, displayNum);
    } catch (cleanupErr) {
      logger.error(
        `[${pageId}] cleanup in error handler failed: ${cleanupErr}`,
      );
    }
    return undefined;
  }
}

export default playwget;
