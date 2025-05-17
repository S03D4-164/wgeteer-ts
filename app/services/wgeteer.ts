import logger from '../utils/logger';
import * as wgeteer from '../utils/wgeteer';
import { Agenda } from 'agenda';

export default async (agenda: Agenda) => {
  agenda.define('wgeteer', async (job: any, done) => {
    console.log(job.attrs.data);
    const data = job.attrs.data;
    if (data.count > 1) {
      logger.error(`wgeteer failed: ${data.pageId}`);
      done();
    } else {
      job.attrs.data.count += 1;
      job.save();
    }
    await wgeteer.wget(data.pageId);
    agenda.now('analyzePage', { pageId: data.pageId });
    done();
  });
};
