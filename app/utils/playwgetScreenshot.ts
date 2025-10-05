import ScreenshotModel from '../models/screenshot';
import Jimp from 'jimp';
import crypto from 'crypto';
import logger from './logger';

async function imgResize(buffer: Buffer): Promise<Buffer> {
  let image = await Jimp.read(buffer);
  if (image.getWidth() > 240) {
    //res.resize(240, Jimp.AUTO);
    let resized = image.resize(240, Jimp.AUTO);
    image = resized.crop(0, 0, 240, 135);
  }
  return image.getBufferAsync(Jimp.MIME_PNG);
}

async function saveFullscreenshot(
  buff: Buffer,
  tag: Array<Record<string, unknown>>,
): Promise<string | undefined> {
  try {
    const md5Hash = crypto.createHash('md5').update(buff).digest('hex');
    const fullscreenshot = buff.toString('base64');

    let ss: any = await ScreenshotModel.findOneAndUpdate(
      { md5: md5Hash },
      { screenshot: fullscreenshot, tag },
      { new: true, upsert: true, strict: true },
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

async function cdpScreenshot(client: any) {
  const base64ss = (
    await client.send('Page.captureScreenshot', {
      captureBeyondViewport: true,
      optimizeForSpeed: true,
    })
  ).data;
  let screenshot = Buffer.from(base64ss, 'base64');
  return screenshot;
}

export { saveFullscreenshot, imgResize, cdpScreenshot };
