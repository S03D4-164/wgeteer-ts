import mongoose from 'mongoose';
import logger from './utils/logger';
import Agenda from 'agenda';
import helloWorld from './services/helloWorld';
import wgeteer from './services/wgeteer';
import camoufox from './services/camoufox';
import playwget from './services/playwget';
import psChrome from './services/psChrome';
import killChrome from './services/killChrome';
import vtPayload from './services/vtPayload';
import gsblookup from './services/gsblookup';
import gsblookupUrl from './services/gsblookupUrl';

import { Worker, Job } from 'bullmq';
import pw from './utils/playwget';
import harparse from './utils/playwgetSave';

const worker = new Worker(
  'ppengo',
  async (job: Job) => {
    //console.log(job);
    if (job.name === 'playwget') {
      await pw(job.data.pageId);
      await harparse(job.data.pageId);
    }
  },
  {
    connection: {
      host: 'localhost',
      port: 6379,
    },
  },
);

const mongoConnectionString = 'mongodb://127.0.0.1:27017/wgeteer';

mongoose
  .connect(mongoConnectionString, {
    maxPoolSize: 1000,
    // useNewUrlParser: true,  // No longer required
    // useCreateIndex: true,   // No longer required
    // useFindAndModify: false, // No longer required
    //useUnifiedTopology: true,
  })
  .then(() => logger.debug('[mongoose] connect completed'))
  .catch((err: Error) => logger.debug('[mongoose] connect error', err));

mongoose.set('maxTimeMS', 30000);

// Import models to ensure they are defined
import './models/webpage';
import './models/request';
import './models/response';
import './models/screenshot';
import './models/payload';

const agenda = new Agenda({
  db: {
    address: mongoConnectionString,
    collection: 'agendaJobs',
  },
  processEvery: '5 seconds',
  defaultLockLifetime: 1000 * 60 * 3,
  defaultConcurrency: 5,
});

agenda.on('ready', async function () {
  await helloWorld(agenda);
  await wgeteer(agenda);
  await camoufox(agenda);
  await playwget(agenda);
  await psChrome(agenda);
  await killChrome(agenda);
  await vtPayload(agenda);
  await gsblookup(agenda);
  await gsblookupUrl(agenda);

  const canceled = await agenda.cancel({
    name: ['wgeteer', 'playwget', 'camoufox'],
  });
  logger.debug(`canceled: ${canceled}`);
  await agenda.now('hello world', { time: new Date() });
  await agenda.start();
});

agenda.on('start', (job) => {
  logger.info(`Job starting ${job.attrs.name}`);
});

agenda.on('complete', (job) => {
  logger.info(`Job ${job.attrs.name} finished`);
});

export { agenda };
