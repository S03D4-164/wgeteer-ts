import crypto from 'crypto';
import logger from './logger';
import PayloadModel from '../models/payload';
import RequestModel from '../models/request';
import ResponseModel from '../models/response';
import WebpageModel from '../models/webpage';
import HarfileModel from '../models/harfile';
import ScreenshotModel from '../models/screenshot';

import mongoose from 'mongoose';
import * as fs from 'fs';
import { analyzePage, analyzeResponses } from './wappalyzer';
import { getHostInfo, setResponseIps } from './ipInfo';
import archiver, { ArchiverOptions } from 'archiver';
archiver.registerFormat('zip-encrypted', require('archiver-zip-encrypted'));

import Jimp from 'jimp';
import explainCode from './gemini';

async function imgResize(buffer: Buffer): Promise<Buffer> {
  let image = await Jimp.read(buffer);
  if (image.getWidth() > 240) {
    //res.resize(240, Jimp.AUTO);
    let resized = image.resize(240, Jimp.AUTO);
    image = resized.crop(0, 0, 240, 135);
  }
  return image.getBufferAsync(Jimp.MIME_PNG);
}

async function saveFullscreenshot(buff: Buffer): Promise<string | undefined> {
  try {
    const md5Hash = crypto.createHash('md5').update(buff).digest('hex');
    const fullscreenshot = buff.toString('base64');

    let ss: any = await ScreenshotModel.findOneAndUpdate(
      { md5: md5Hash },
      { screenshot: fullscreenshot },
      { new: true, upsert: true, strict: true },
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

async function savePayload(
  responseBuffer: Buffer,
): Promise<mongoose.Types.ObjectId | undefined> {
  try {
    const md5Hash = crypto
      .createHash('md5')
      .update(responseBuffer)
      .digest('hex');
    const payload = await PayloadModel.findOneAndUpdate(
      { md5: md5Hash },
      { payload: responseBuffer },
      { new: true, upsert: true },
    ).exec();
    if (payload && typeof payload === 'object' && '_id' in payload) {
      return payload._id as mongoose.Types.ObjectId;
    }
  } catch (err: any) {
    logger.error(err);
    console.log(err);
  }
  return undefined;
}

async function saveResponse(
  response: any,
  request: any,
  pageId: mongoose.Types.ObjectId,
): Promise<any> {
  /*
  let responseBuffer: Buffer | undefined;
  let payloadId: string | undefined;
  const responseStatus: number = response.status;
  if (responseBuffer) {
    payloadId = await savePayload();
  }
  */
  let text: string | undefined;
  let mimeType: string | undefined;
  let encoding: string | undefined;
  try {
    //if (!text && responseStatus >= 200) {
    if (response.content) {
      if (response.content.text) {
        text = response.content.text;
      }
      if (response.content.mimeType) {
        mimeType = response.content.mimeType;
      }
      if (response.content.encoding) {
        encoding = response.content.encoding;
        if (text && encoding == 'base64') {
          text = Buffer.from(text, 'base64').toString();
          encoding = undefined;
        }
      }
    }
  } catch (err: any) {
    logger.error('[Response] failed on save text', err);
  }

  let securityDetails: any = {};
  try {
    const secDetails = response.securityDetails;
    if (secDetails) {
      securityDetails = {
        issuer: secDetails.issuer,
        protocol: secDetails.protocol,
        subjectName: secDetails.subjectName,
        validFrom: secDetails.validFrom,
        validTo: secDetails.validTo,
      };
    }
  } catch (error: any) {
    logger.debug(error);
  }

  //try {
  const url: string = request.url;
  let urlHash: any;
  if (url) {
    urlHash = crypto.createHash('md5').update(url).digest('hex');
  }
  const headers: any = response.headers;
  let statusText: string | undefined;
  if (response._failureText) {
    statusText = response._failureText;
  }

  const newResponse = {
    webpage: pageId,
    url,
    urlHash,
    status: response.status,
    statusText,
    //ok: response.ok,
    //remoteAddress: response.remoteAddress,
    headers,
    securityDetails,
    //payload: payloadId,
    text,
    encoding,
    mimeType,
    //interceptionId,
  };

  if (text) {
    const sizelimit: number = 16 * 1024 * 1024;
    const resLength: number = JSON.stringify(response).length;
    if (resLength > sizelimit) {
      newResponse.text = undefined;
    }
  }
  return newResponse;
  /*
  } catch (error: any) {
    logger.error(error);
    return undefined;
  }
    */
}

async function saveRequest(
  request: any,
  pageId: mongoose.Types.ObjectId,
): Promise<any | undefined> {
  let redirectChain: string[] = [];

  const headers: any = request.headers;

  try {
    const newRequest: any = {
      webpage: pageId,
      url: request.url,
      method: request.method,
      resourceType: request.resourceType,
      isNavigationRequest: request.isNavigationRequest,
      //postData: request.postData,
      headers,
      failure: request.failure,
      redirectChain,
    };
    if (request.postData) {
      newRequest.postData = request.postData.text;
    }
    return newRequest;
  } catch (err: any) {
    logger.error(err);
    return undefined;
  }
}

async function createZip(
  data: Buffer,
  filename: string,
  password: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver.create('zip-encrypted', {
      zlib: { level: 5 },
      encryptionMethod: 'zip20',
      password,
    } as unknown as ArchiverOptions);
    const buffers: Buffer[] = [];

    archive.on('data', (buffer: Buffer) => buffers.push(buffer));
    archive.on('end', () => resolve(Buffer.concat(buffers)));
    archive.on('error', (err: Error) => reject(err));

    archive.append(data, { name: filename });
    archive.finalize();
  });
}

async function saveHarfile(
  harfile: any,
  pageId: any,
): Promise<string | undefined> {
  const buf = fs.readFileSync(harfile);
  //logger.debug(buf.length);
  const zipedHar = await createZip(buf, `${pageId}.har`, 'infected');
  //logger.debug(zipedHar.length);

  const newHarfile: any = new HarfileModel({
    webpage: pageId,
    har: zipedHar,
  });
  if (newHarfile) {
    await newHarfile.save();
    return newHarfile._id.toString();
  } else {
    return undefined;
  }
}

async function harparse(pageId: string): Promise<void> {
  const dataDir = `/tmp/${pageId}`;
  const recordHar = `${dataDir}/pw.har`;
  logger.info(`${recordHar}`);
  let requestArray: any[] = [];
  let responseArray: any[] = [];
  let webpage = await WebpageModel.findById(pageId).exec();
  let har;
  try {
    har = JSON.parse(fs.readFileSync(recordHar, 'utf-8'));
    //explainCode(JSON.stringify(har));
    const entries = har.log.entries;
    let i = 1;
    for (const entry of entries) {
      if (!entry.request.url.startsWith('chrome-extension')) {
        let request = await saveRequest(
          entry.request,
          webpage?._id as mongoose.Types.ObjectId,
        );
        if (request) {
          request.interceptionId = String(i);
          //logger.debug(request);
          requestArray.push(request);
        }
        let response = await saveResponse(
          entry.response,
          entry.request,
          webpage?._id as mongoose.Types.ObjectId,
        );
        if (response) {
          response.interceptionId = String(i);
          response.remoteAddress = {
            ip: entry.serverIPAddress,
            port: entry._serverPort,
          };
          response.securityDetails = entry._securityDetails;
          //console.log(response);
          responseArray.push(response);
        }
        i++;
      }
    }
  } catch (error) {
    console.log(error);
  }
  let requests: any[] = [];
  requests = await RequestModel.find({ webpage });
  if (requests.length == 0) {
    try {
      let start = new Date();
      logger.debug(`[Request] save: ${requestArray.length}`);
      requests = await RequestModel.insertMany(requestArray, {
        ordered: false,
      });
      let end = new Date();
      let time = Number(end) - Number(start);
      logger.debug(
        `[Request] saved: ${requests.length} Execution time: ${time}ms`,
      );
    } catch (err: any) {
      logger.error(`[Request] ${err}`);
    }
  }
  let responses: any[] = [];
  responses = await ResponseModel.find({ webpage });
  if (responses.length == 0) {
    if (webpage?.option.bulksave) {
      try {
        let start = new Date();
        logger.debug(`[Response] bulk save: ${responseArray.length}`);
        responses = await ResponseModel.insertMany(responseArray, {
          ordered: false,
          //lean: true,
          //rawResult: true,
        });
        let end = new Date();
        let time = Number(end) - Number(start);
        logger.debug(
          `[Response] bulk saved: ${responses.length} Execution time: ${time}ms`,
        );
      } catch (err: any) {
        logger.error(`[Response] ${err}`);
      }
    }
  }
  if (responses.length == 0) {
    let start = new Date();
    logger.debug(`[Response] save: ${responseArray.length}`);
    for (let res of responseArray) {
      try {
        /*
        console.log(
          res.interceptionId,
          res.mimeType,
          res.text?.length,
          res.url,
        );
        */
        const newRes = new ResponseModel(res);
        await newRes.save({ validateBeforeSave: false, w: 0 });
        //responses.push(newRes);
      } catch (err) {
        logger.error(`[Response] ${err}`);
      }
    }
    responses = await ResponseModel.find({ webpage });
    let end = new Date();
    let time = Number(end) - Number(start);
    logger.debug(
      `[Response] saved: ${responses.length} Execution time: ${time}ms`,
    );
  }

  if (webpage) {
    let finalResponse: any;
    try {
      if (requests && responses) {
        for (const res of responses) {
          for (const req of requests) {
            if (res.interceptionId === req.interceptionId) {
              //logger.debug(`${req.interceptionId}, ${res.interceptionId}`);
              res.request = req;
              req.response = res;
              break;
            }
          }
        }
      }
      if (requests) {
        await RequestModel.bulkSave(requests, { ordered: false });
        requests = await RequestModel.find({ webpage }).sort({
          interceptionId: 1,
        });
        webpage.requests = requests;
      }
      if (responses) {
        //responses = await setResponseIps(responses);
        responses = await analyzeResponses(responses);
        await ResponseModel.bulkSave(responses, {
          ordered: false,
          //timestamps: false,
        });
        responses = await ResponseModel.find({ webpage }).sort({
          interceptionId: 1,
        });
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

        const wapps = await analyzePage(webpage);
        if (wapps) webpage.wappalyzer = wapps;

        if (webpage.remoteAddress?.ip) {
          logger.info(webpage.remoteAddress);
          let hostinfo = await getHostInfo(webpage.remoteAddress.ip);
          logger.info(hostinfo);
          if (hostinfo) {
            const remoteAddress: any = {};
            if (hostinfo.reverse) remoteAddress.reverse = hostinfo.reverse;
            if (hostinfo.bgp) remoteAddress.bgp = hostinfo.bgp;
            if (hostinfo.geoip) remoteAddress.geoip = hostinfo.geoip;
            if (hostinfo.ip) remoteAddress.ip = hostinfo.ip;
            else remoteAddress.ip = webpage.remoteAddress.ip;
            remoteAddress.port = webpage.remoteAddress.port;
            webpage.remoteAddress = remoteAddress;
          }
        }
      }

      let harId;
      if (recordHar && webpage) {
        harId = await saveHarfile(recordHar, webpage._id);
        if (harId) webpage.harfile = new mongoose.Types.ObjectId(harId);
      }
      logger.debug(webpage.remoteAddress);
      await webpage?.save();
      responses = await setResponseIps(responses);
      await ResponseModel.bulkSave(responses, {
        ordered: false,
      });
    } catch (err) {
      console.log(err);
    }
  }

  return;
}

export default harparse;
export { savePayload, saveFullscreenshot, imgResize };
