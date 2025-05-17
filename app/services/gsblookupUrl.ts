import logger from '../utils/logger';
import * as gsblookup from '../utils/gsblookup';
import { Agenda } from 'agenda';

export default async (agenda: Agenda) => {
  agenda.define('gsblookupUrl', async (job: any, done) => {
    logger.debug(job.attrs);
    try {
      const result = await gsblookup.lookupUrl(job.attrs.data.url);
      logger.debug(result);
      //await agenda.now("gsbUrlResult", { result: result });
      done();
    } catch (error) {
      logger.error('Error during gsblookupUrl:', error);
      done();
    }
  });
};
