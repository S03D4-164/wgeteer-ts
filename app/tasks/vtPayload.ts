import logger from '../modules/logger';
import * as vt from '../modules/vt';
import { Agenda } from 'agenda';

export default async (agenda: Agenda) => {
  agenda.define('vtPayload', async (job: any, done) => {
    logger.debug(job.attrs);
    try {
      await vt.vtPayload(job.attrs.data.payloadId);
      logger.debug('vtPayload success');
      done();
    } catch (error) {
      logger.error('vtPayload error', error);
      done();
    }
  });
};
