import crypto from 'crypto';
import ScreenshotModel from '../models/screenshot';
import logger from './logger';
async function saveFullscreenshot(
  fullscreenshot: string,
): Promise<string | undefined> {
  try {
    const buff = Buffer.from(fullscreenshot, 'base64');
    const md5Hash = crypto.createHash('md5').update(buff).digest('hex');
    let ss: any = await ScreenshotModel.findOneAndUpdate(
      { md5: md5Hash },
      { screenshot: fullscreenshot },
      { new: true, upsert: true },
    ).exec();

    if (ss) {
      return ss._id.toString();
    } else {
      logger.warn('Screenshot not saved.');
      return undefined;
    }
  } catch (err: any) {
    logger.error(err);
    return undefined;
  }
}

export { saveFullscreenshot };
