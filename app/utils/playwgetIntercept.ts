import crypto from 'crypto';
import logger from './logger';
import PayloadModel from '../models/payload';
import mongoose from 'mongoose';

async function savePayload(
  responseBuffer: Buffer,
): Promise<string | undefined> {
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
      return (payload as { _id: mongoose.Types.ObjectId })._id.toString();
    }
    return undefined;
  } catch (err: any) {
    logger.error(err);
    return undefined;
  }
}

async function saveResponse(
  interceptedResponse: any,
  pageId: string,
  responseCache: any[],
): Promise<any> {
  let responseBuffer: Buffer | undefined;
  let text: string | undefined;
  let payloadId: string | undefined;
  const responseStatus: number = await interceptedResponse.status();
  let interceptionId: string | undefined;

  try {
    for (const cache of responseCache) {
      if (
        interceptedResponse.url() === cache.url &&
        cache.status === responseStatus
      ) {
        responseBuffer = cache.body;
        if (responseBuffer) text = cache.body.toString('utf-8');
        interceptionId = cache.interceptionId;
        break;
      }
    }

    if (!responseBuffer && responseStatus >= 200 && responseStatus < 300) {
      responseBuffer = await interceptedResponse.body();
    }
  } catch (err: any) {
    logger.error(`[Response] failed on save buffer ${err}`);
  }

  if (responseBuffer) {
    payloadId = await savePayload(responseBuffer);
  }

  try {
    if (!text && responseStatus >= 200 && responseStatus < 300) {
      text = await interceptedResponse.text();
    }
  } catch (err: any) {
    logger.error(`[Response] failed on save text ${err}`);
  }

  let securityDetails: any = {};
  try {
    const secDetails = await interceptedResponse.securityDetails();
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

  const serverAddr = await interceptedResponse.serverAddr();
  let remoteAddress: any = {};
  if (serverAddr) {
    remoteAddress = {
      ip: serverAddr.ipAddress,
      port: serverAddr.port,
    };
  }
  try {
    const url: string = interceptedResponse.url();
    const urlHash: string = crypto.createHash('md5').update(url).digest('hex');
    const headers: any = interceptedResponse.headers();
    const newHeaders: any = {};

    for (const key of Object.keys(headers)) {
      const newKey: string = key.includes('.')
        ? key.replace(/\./g, '\uff0e')
        : key;
      newHeaders[newKey] = headers[key];
    }

    const response = {
      webpage: pageId,
      url,
      urlHash,
      status: interceptedResponse.status(),
      statusText: interceptedResponse.statusText(),
      ok: interceptedResponse.ok(),
      remoteAddress,
      headers: newHeaders,
      securityDetails,
      payload: payloadId,
      text,
      interceptionId,
    };

    if (text) {
      const sizelimit: number = 16000000;
      const resLength: number = JSON.stringify(response).length;
      if (resLength > sizelimit) {
        response.text = undefined;
      }
    }
    return response;
  } catch (error: any) {
    logger.error(error);
    return undefined;
  }
}

async function saveRequest(
  interceptedRequest: any,
  pageId: string,
): Promise<any> {
  let redirectChain: string[] = [];
  try {
    const chain: any[] = interceptedRequest.redirectChain();
    if (chain) {
      for (const seq of chain) {
        redirectChain.push(seq.url());
      }
    }
  } catch (error: any) {
    //logger.error(error);
  }

  const headers: any = interceptedRequest.headers();
  const newHeaders: any = {};
  for (const key of Object.keys(headers)) {
    const newKey: string = key.includes('.')
      ? key.replace(/\./g, '\uff0e')
      : key;
    newHeaders[newKey] = headers[key];
  }

  try {
    const request: any = {
      webpage: pageId,
      url: interceptedRequest.url(),
      method: interceptedRequest.method(),
      resourceType: interceptedRequest.resourceType(),
      isNavigationRequest: interceptedRequest.isNavigationRequest(),
      postData: interceptedRequest.postData(),
      headers: newHeaders,
      failure: interceptedRequest.failure(),
      redirectChain,
    };
    return request;
  } catch (err: any) {
    logger.error(err);
    return undefined;
  }
}

export { saveRequest, saveResponse };
