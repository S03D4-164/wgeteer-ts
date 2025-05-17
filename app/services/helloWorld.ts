import logger from '../utils/logger';
import { Agenda } from 'agenda';

export default async (agenda: Agenda) => {
  agenda.define('hello world', async (job, done) => {
    logger.debug('agenda ready');
    done();
  });
};
