import { yaraSource } from './yara';
import logger from './logger';
import {
  saveFullscreenshot,
  imgResize,
  cdpScreenshot,
} from './playwgetScreenshot';
import mongoose from 'mongoose';

async function playwgetAction(page: any, webpage: any, client: any) {
  const pageId = webpage._id;
  const delay = Number(webpage.option.delay) * 1000;

  // client の有効性チェック
  if (!client || page.isClosed()) {
    logger.debug(
      `[${pageId}] Page already closed or client unavailable, skipping actions`,
    );
    return;
  }

  // execute actions
  let actions;
  let yararule = await yaraSource(await page.content());
  if (yararule?.actions) {
    logger.debug(`[${pageId}] ${yararule}`);
    actions = yararule.actions;
    //webpage.yara = yararule;
  }
  if (webpage.option.actions) {
    actions = webpage.option.actions;
  }
  if (actions && actions.length > 1) {
    webpage.option.actions = actions;
    const lines = actions.split('\r\n');
    let limit = 5;
    let ssarray: any[] = [];
    for (let line of lines) {
      // ループ内でも client と page の有効性をチェック
      if (page.isClosed() || !client) {
        logger.debug(
          `[${pageId}] Page closed during action execution, stopping actions`,
        );
        break;
      }

      // screenshot before action
      let ssobj: any = {};
      let screenshot;
      try {
        if (client) {
          screenshot = await cdpScreenshot(client);
        } else {
          screenshot = await page.screenshot({ fullPage: true });
        }
      } catch (err) {
        logger.error(`[${pageId}] Screenshot capture failed: ${err}`);
        // スクリーンショット失敗時は処理を続行
      }

      if (screenshot) {
        try {
          const resizedImg = await imgResize(screenshot);
          if (resizedImg) {
            ssobj.thumbnail = resizedImg.toString('base64');
          }
          let fss = await saveFullscreenshot(screenshot, []);
          if (fss) {
            ssobj.full = new mongoose.Types.ObjectId(fss);
          }
        } catch (err) {
          logger.error(`[${pageId}] Screenshot processing failed: ${err}`);
        }
      }
      if (ssobj && Object.keys(ssobj).length > 0) {
        //console.log(ssobj);
        ssarray.push(ssobj);
      }

      // actions
      let elem = line.split('>');
      let action = elem[0]?.trim();
      let target = elem[1]?.trim();
      let input = elem[2]?.trim();
      let last = elem[3]?.trim();
      logger.debug(`[${pageId}] action: ${action}, target: ${target}`);
      let options = {
        timeout: delay,
      };

      try {
        if (action == 'eval') {
          await page.evaluate(target, options);
        } else {
          let loc = page.locator(target);
          if (action == 'clicktxt') {
            loc = page.getByText(target);
          }
          if (last == 'last') loc = loc.last();
          else loc = loc.first();
          if (action == 'click' || action == 'clicktxt') {
            await loc.click(options);
          } else if (action == 'fill') {
            await loc.fill(input, options);
          } else if (action == 'press') {
            await loc.press(input, options);
          }
        }
      } catch (err) {
        logger.error(
          `[${pageId}] Action execution failed: ${action} ${target} - ${err}`,
        );
        // アクション失敗時は処理を続行
      }

      //await new Promise((done) => setTimeout(done, delay));
      limit--;
      if (limit <= 0) break;
    }
    //console.log(ssarray);
    if (ssarray.length > 0) {
      webpage.screenshots = ssarray;
    }
    await new Promise((done) => setTimeout(done, delay));
    return;
  } else {
    return;
  }
}

export { playwgetAction };
