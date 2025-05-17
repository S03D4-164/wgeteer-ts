import logger from '../utils/logger';
import findChrome from '../utils/findproc';
import { Agenda, JobAttributesData } from 'agenda';

export default async (agenda: Agenda) => {
  agenda.define('psChrome', async function (job: JobAttributesData, done) {
    await job.setShouldSaveResult(true);
    const ps = await findChrome(0);
    job.attrs.data = ps;
    await job.save();
    done();
  });
};
