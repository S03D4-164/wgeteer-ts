import logger from '../utils/logger';
import playwget from '../utils/playwget';
import harparse, { linkRequestsAndResponses } from '../utils/playwgetSave';

import { Agenda } from 'agenda';

export default async (agenda: Agenda) => {
  agenda.define('playwget', async (job: any, done) => {
    const data = job.attrs.data;
    while (job.attrs.data.count < 2) {
      job.attrs.data.count += 1;
      job.save();
      logger.info(job.attrs.data);
      const result = await playwget(data.pageId);
      if (result) {
        try {
          const WebpageModel = require('../models/webpage').default;
          const webpage = await WebpageModel.findById(data.pageId).exec();
          if (webpage?.option?.saveHarfile) {
            // HARファイルをパース＋紐付けを実行
            await harparse(data.pageId);
          } else {
            // HARファイルなしでも紐付けとIP情報を取得
            await linkRequestsAndResponses(data.pageId);
          }
        } catch (err) {
          logger.error(
            `[${data.pageId}] Failed to process requests/responses: ${err}`,
          );
        }
        agenda.now('analyzePage', { pageId: data.pageId });
        break;
      }
    }
    done();
  });
};
