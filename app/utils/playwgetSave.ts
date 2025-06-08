import crypto from 'crypto';
import logger from './logger';
import PayloadModel from '../models/payload';
import RequestModel from '../models/request';
import ResponseModel from '../models/response';
import WebpageModel from '../models/webpage';
import HarfileModel from '../models/harfile';
import mongoose from 'mongoose';
import * as fs from 'fs';
import { getHostInfo, setResponseIps } from './ipInfo';
import archiver, { ArchiverOptions } from 'archiver';
archiver.registerFormat('zip-encrypted', require('archiver-zip-encrypted'));

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
    const sizelimit: number = 16000000;
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
    const entries = har.log.entries;
    let i = 0;
    for (const entry of entries) {
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
  } catch (error) {
    console.log(error);
  }
  let requests: any[] = [];
  try {
    logger.debug(`[Request] save: ${requestArray.length}`);
    requests = await RequestModel.insertMany(requestArray, { ordered: false });
    logger.debug(`[Request] saved: ${requests.length}`);
  } catch (err: any) {
    logger.error(`[Request] ${err}`);
  }

  let responses: any[] = [];
  try {
    logger.debug(`[Response] save: ${responseArray.length}`);
    responses = await ResponseModel.insertMany(responseArray, {
      ordered: false,
      //rawResult: true,
    });
    logger.debug(`[Response] saved: ${responses.length}`);
  } catch (err: any) {
    logger.error(`[Response] ${err}`);
  }
  if (responses.length == 0) {
    for (let res of responseArray) {
      try {
        const newRes = new ResponseModel(res);
        await newRes.save();
        responses.push(newRes);
      } catch (err) {
        console.log('[Response]', err);
        logger.error(`[Response] ${err}`);
      }
    }
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
        webpage.requests = requests;
      }
      if (responses) {
        responses = await setResponseIps(responses);
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
        /*
        if (webpage.remoteAddress?.ip) {
          logger.info(webpage.remoteAddress);
          let hostinfo = await getHostInfo(webpage.remoteAddress.ip);
          if (hostinfo) {
            if (hostinfo.reverse) {
              webpage.remoteAddress.reverse = hostinfo.reverse;
            }
            if (hostinfo.bgp) {
              hostinfo.bgp.forEach((item: any) =>
                webpage.remoteAddress?.bgp.push(item),
              );
            }
            if (hostinfo.geoip) {
              webpage.remoteAddress?.geoip.push(hostinfo.geoip);
            }
            if (hostinfo.ip) {
              webpage.remoteAddress.ip = hostinfo.ip;
            }
          }
        }*/
      }

      let harId;
      if (recordHar && webpage) {
        harId = await saveHarfile(recordHar, webpage._id);
        if (harId) webpage.harfile = new mongoose.Types.ObjectId(harId);
      }
      logger.debug(webpage.remoteAddress);
      await webpage?.save();
    } catch (err) {
      console.log(err);
    }
  }

  return;
}

export default harparse;
export { savePayload };
