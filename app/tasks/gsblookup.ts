import logger from '../modules/logger';
import * as gsblookup from '../modules/gsblookup';
import { Agenda, JobAttributesData } from 'agenda';

export default async (agenda: Agenda) => {
  agenda.define('gsblookup', async (job: JobAttributesData, done) => {
    logger.debug(job.attrs);
    if (job.attrs.data && job.attrs.data.websiteId) {
      try {
        const result = await gsblookup.lookupSite(job.attrs.data.websiteId);
        logger.debug(result);
        //await agenda.now("gsbUrlResult", { result: result });
        done();
      } catch (error) {
        logger.error('Error during gsblookup:', error);
        done();
      }
    } else {
      logger.error('websiteId is missing in job data');
      done();
    }
  });
};
