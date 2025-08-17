import logger from '../utils/logger';
import playwget from '../utils/playwget';
import harparse from '../utils/playwgetSave';

import { Agenda } from 'agenda';

export default async (agenda: Agenda) => {
  agenda.define('playwget', async (job: any, done) => {
    const data = job.attrs.data;
    while (job.attrs.data.count < 2) {
      job.attrs.data.count += 1;
      job.save();
      logger.info(job.attrs.data);
      const result = await playwget(data.pageId);
      if (result) {
        await harparse(data.pageId);
        agenda.now('analyzePage', { pageId: data.pageId });
        break;
      }
    }
    done();
  });
};
