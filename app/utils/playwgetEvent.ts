import logger from './logger';
import { savePayload } from './playwgetSave';

async function pptrEventSet(
  browserContext: any,
  page: any,
  webpage: any,
): Promise<void> {
  const pageId = webpage._id;
  /*
  page.on('request', (request: any) => {
    //logger.debug(`Request: ${request.url()}`);
  });
  page.on('requestfinished', async (request: any) => {
    const res = await request.response();
    logger.debug(`Finished: ${res.url()}`);
  });
  page.on('requestfailed', (request: any) => {
    logger.debug(`Failed: ${request.failure().errorText} ${request.url()}`);
  });
    */
  const browser = browserContext.browser();
  if (browser) {
    browser.once('disconnected', () =>
      logger.debug(`[${pageId}] browser disconnected`),
    );
  }
  browserContext.once('close', () =>
    logger.debug(`[${pageId}] browserContext closed`),
  );
  page.once('crash', async (page: any) => {
    logger.error(`[${pageId}] Page crashed: ${page.url()}`);
  });
  page.once('domcontentloaded', async (page: any) => {
    logger.debug(`[${pageId}] DOM content loaded: ${page.url()}`);
  });
  page.once('close', async (page: any) => {
    logger.debug(`[${pageId}] Page closed: ${page.url()}`);
  });
  page.once('load', async (page: any) => {
    logger.debug(`[${pageId}] Page loaded: ${page.url()}`);
  });
  page.on('dialog', (dialog: any) => dialog.dismiss());
  // Log all uncaught errors to the terminal
  page.on('pageerror', (exception: any) => {
    logger.error(`[${pageId}] Uncaught exception: "${exception}"`);
  });
  // download pdf
  if (webpage.option.pdf) {
    await page.route('**/*', async (route: any, request: any) => {
      if (
        request.resourceType() === 'document' &&
        route.request().url().endsWith('.pdf')
      ) {
        const response = await page.context().request.get(request.url());
        await route.fulfill({
          response,
          headers: {
            ...response.headers(),
            'Content-Disposition': 'attachment',
          },
        });
      } else {
        route.continue();
      }
    });
  }
  page.once('download', async (download: any) => {
    logger.info(`Download started: ${download.url()}`);
    async function readableToBuffer(readable: any): Promise<Buffer> {
      return new Promise((resolve, reject) => {
        const chunks: any = [];
        readable.on('data', (chunk: Buffer) => {
          logger.debug(`Received ${chunk.length} bytes of data.`);
          chunks.push(chunk);
        });
        readable.on('error', () => {
          logger.error('Error reading download stream');
          reject;
        });
        readable.on('end', () => {
          logger.info('Download stream ended.');
          resolve(Buffer.concat(chunks));
        });
      });
    }
    const read = await download.createReadStream();
    try {
      const buffer: any = await readableToBuffer(read);
      logger.debug(`Downloaded ${buffer.length} bytes of data.`);
      const payloadId: any = await savePayload(buffer);
      if (payloadId) {
        logger.debug(`Payload saved with ID: ${payloadId}`);
        webpage.payload = payloadId;
        webpage.error = 'A file has been downloaded.';
        await webpage.save();
      }
    } catch (err) {
      logger.error(`Error processing download: ${err}`);
    }
  });
}

export default pptrEventSet;
