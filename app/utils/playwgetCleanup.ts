import fs from 'fs';
import findProc from 'find-process';
import logger from './logger';
import { execSync } from 'child_process';

async function cleanup(pageId: string, displayNum: string | undefined) {
  const dataDir = `/tmp/ppengo/${pageId}`;
  if (!displayNum) {
    if (fs.existsSync(`${dataDir}/displayNum`)) {
      try {
        displayNum = fs.readFileSync(`${dataDir}/displayNum`, 'utf-8').trim();
      } catch (err) {
        logger.error(`${pageId}: Failed to read displayNum: ${err}`);
      }
    }
  }

  try {
    // chrome: 通常のkill
    const chromePs = await findProc('name', 'chrome');
    if (chromePs) {
      for (const ps of chromePs) {
        if (ps.name === 'chrome' && ps.cmd.includes(`${dataDir}`)) {
          logger.debug(`${pageId}: kill chrome ${ps.pid}`);
          try {
            process.kill(ps.pid, 'SIGTERM');
          } catch (err) {
            logger.error(`${pageId}: Failed to kill chrome ${ps.pid}: ${err}`);
          }
        }
      }
    }

    // 1秒待機してから、まだ残っていたら強制kill
    await new Promise((done) => setTimeout(done, 1000));
    const chromePs2 = await findProc('name', 'chrome');
    if (chromePs2) {
      for (const ps of chromePs2) {
        if (ps.name === 'chrome' && ps.cmd.includes(`${dataDir}`)) {
          logger.debug(`${pageId}: force kill chrome ${ps.pid}`);
          try {
            process.kill(ps.pid, 'SIGKILL');
          } catch (err) {
            logger.error(
              `${pageId}: Failed to force kill chrome ${ps.pid}: ${err}`,
            );
          }
        }
      }
    }

    // Xvfb
    if (displayNum) {
      const xvfbPs = await findProc('name', 'Xvfb');
      if (xvfbPs) {
        for (const ps of xvfbPs) {
          if (ps.name === 'Xvfb' && ps.cmd.includes(`:${displayNum}`)) {
            logger.debug(`${pageId}: kill Xvfb ${ps.pid}`);
            try {
              process.kill(ps.pid, 'SIGTERM');
            } catch (err) {
              logger.error(`${pageId}: Failed to kill Xvfb ${ps.pid}: ${err}`);
            }
          }
        }
      }

      // fluxbox
      const fluxboxPs = await findProc('name', 'fluxbox');
      if (fluxboxPs) {
        for (const ps of fluxboxPs) {
          if (ps.name === 'fluxbox' && ps.cmd.includes(`:${displayNum}`)) {
            logger.debug(`${pageId}: kill fluxbox ${ps.pid}`);
            try {
              process.kill(ps.pid, 'SIGTERM');
            } catch (err) {
              logger.error(
                `${pageId}: Failed to kill fluxbox ${ps.pid}: ${err}`,
              );
            }
          }
        }
      }
    }

    // データディレクトリを削除
    if (fs.existsSync(dataDir)) {
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
        logger.debug(`${pageId}: Removed ${dataDir}`);
      } catch (err) {
        logger.error(`${pageId}: Failed to remove ${dataDir}: ${err}`);
      }
    }
  } catch (err) {
    logger.error(`${pageId}: cleanup error: ${err}`);
  }
}

export default cleanup;
