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
      // screenshot before action
      let ssobj: any = {};
      let screenshot;
      if (client) {
        screenshot = await cdpScreenshot(client);
      } else {
        screenshot = await page.screenshot({ fullPage: true });
      }
      if (screenshot) {
        const resizedImg = await imgResize(screenshot);
        if (resizedImg) {
          ssobj.thumbnail = resizedImg.toString('base64');
        }
        let fss = await saveFullscreenshot(screenshot, []);
        if (fss) {
          ssobj.full = new mongoose.Types.ObjectId(fss);
        }
      }
      if (ssobj) {
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
