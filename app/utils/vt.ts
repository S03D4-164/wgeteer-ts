import superagent from 'superagent';
import qs from 'querystring';
import PayloadModel, { IPayload } from '../models/payload';
import logger from './logger';

const ak = process.env.VTKEY;
const vtApiEndpoint = 'https://www.virustotal.com/vtapi/v2/';

interface VTFileReportResponse {
  [key: string]: any;
  error?: string;
}

async function vtFileReport(resource: string): Promise<VTFileReportResponse> {
  const arg = {
    apikey: ak,
    resource: resource,
  };
  const url = vtApiEndpoint + 'file/report?' + qs.stringify(arg);

  try {
    logger.debug({ url });
    const res = await superagent.get(url).set('Accept', 'application/json');
    logger.debug(res.body);
    return res.body;
  } catch (err: any) {
    logger.error(err);
    return { error: err.message };
  }
}

async function vt(resource: string): Promise<VTFileReportResponse> {
  const body = await vtFileReport(resource);
  return body;
}

async function vtPayload(payloadId: string): Promise<VTFileReportResponse> {
  try {
    const payload: IPayload | null = await PayloadModel.findById(payloadId);

    if (!payload) {
      return { error: 'Payload not found' };
    }

    const resource = payload.md5;
    logger.debug(resource);
    const body = await vtFileReport(resource);
    payload.vt = body;
    await payload.save();
    return body;
  } catch (err: any) {
    logger.error(err);
    return { error: err.message };
  }
}

export { vt, vtPayload };
