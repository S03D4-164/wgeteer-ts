import logger from '../utils/logger';
import camowget from '../utils/camoufox';
import harparse from '../utils/playwgetSave';

import { Agenda } from 'agenda';

export default async (agenda: Agenda) => {
  agenda.define('camoufox', async (job: any, done) => {
    const data = job.attrs.data;
    while (job.attrs.data.count < 2) {
      job.attrs.data.count += 1;
      job.save();
      logger.info(job.attrs.data);
      const result = await camowget(data.pageId);
      if (result) {
        await harparse(data.pageId);
        agenda.now('analyzePage', { pageId: data.pageId });
        break;
      }
    }
    done();
  });
};
