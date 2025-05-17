import findProc from 'find-process';
import logger from './logger';

interface ProcessInfo {
  pid: number;
  name: string;
  cmd: string;
}

async function psChrome(pageId: number): Promise<ProcessInfo[] | undefined> {
  let pslist: ProcessInfo[] | undefined;
  try {
    pslist = await findProc('name', 'chrome') as ProcessInfo[];

    if (pslist) {
      for (const ps of pslist) {
        if (ps.name === 'chrome') {
          if (pageId > 0) {
            if (ps.cmd.includes(`/tmp/${pageId}`)) {
              logger.debug(`Killing process ${ps.pid} with command ${ps.cmd}`);
              process.kill(ps.pid);
            }
          } else {
            logger.debug(`Killing process ${ps.pid} with command ${ps.cmd}`);
            process.kill(ps.pid);
          }
        }
      }
    }

    if (pageId === -1) {
      pslist = await findProc('name', 'chrome') as ProcessInfo[];
    }
  } catch (err: any) {
    logger.error(err);
  }
  logger.debug(pslist);
  return pslist;
}

export default psChrome;
