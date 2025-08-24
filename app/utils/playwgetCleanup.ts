import fs from 'fs';
import findProc from 'find-process';
import logger from './logger';

async function cleanup(pageId: string, displayNum: string | undefined) {
  const dataDir = `/tmp/ppengo/${pageId}`;
  if (!displayNum) {
    if (fs.existsSync(`${dataDir}/displayNum`)) {
      displayNum = fs.readFileSync(`${dataDir}/displayNum`, 'utf-8');
    }
  }
  try {
    //chrome
    const chromePs = await findProc('name', 'chrome');
    if (chromePs) {
      for (const ps of chromePs) {
        //console.log(ps);
        if (ps.name === 'chrome' && ps.cmd.includes(`${dataDir}`)) {
          logger.debug(`${pageId}: kill ${ps}`);
          process.kill(ps.pid);
        }
      }
    }

    //Xvfb
    const xvfbPs = await findProc('name', 'Xvfb');
    if (xvfbPs) {
      for (const ps of xvfbPs) {
        if (ps.name === 'Xvfb' && ps.cmd.includes(`${displayNum}`)) {
          logger.debug(`${pageId}: kill ${ps}`);
          process.kill(ps.pid);
        }
      }
    }

    //fluxbox
    const fluxboxPs = await findProc('name', 'fluxbox');
    if (fluxboxPs) {
      for (const ps of fluxboxPs) {
        if (ps.name === 'fluxbox' && ps.cmd.includes(`${displayNum}`)) {
          logger.debug(`${pageId}: kill ${ps}`);
          process.kill(ps.pid);
        }
      }
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch (err) {
    logger.error(`${pageId}: ${err}`);
  }
}

export default cleanup;
