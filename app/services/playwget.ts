import logger from '../utils/logger';
import playwget from '../utils/playwget';
import harparse from '../utils/playwgetSave';

import { Agenda } from 'agenda';

export default async (agenda: Agenda) => {
  agenda.define('playwget', async (job: any, done) => {
    logger.info(job.attrs.data);
    const data = job.attrs.data;
    if (data.count > 1) {
      logger.error(`playwget failed: ${data.pageId}`);
      done();
    } else {
      job.attrs.data.count += 1;
      job.save();
    }
    await playwget(data.pageId);
    await harparse(data.pageId);
    agenda.now('analyzePage', { pageId: data.pageId });
    done();
  });
};
