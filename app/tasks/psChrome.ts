import logger from '../modules/logger';
import findChrome from '../modules/findproc';
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
