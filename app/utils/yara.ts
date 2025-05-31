import yara from 'yara';
import YaraModel from '../models/yara';
import logger from './logger';

interface YaraScanResult {
  rules: Array<{ id: string; tags: string[]; meta: Record<string, any> }>;
}

const yaraScan = async (source: string): Promise<YaraScanResult | null> => {
  return new Promise((resolve, reject) => {
    yara.initialize(async (error: Error | null) => {
      if (error) {
        logger.error(error.message);
        reject(null);
      } else {
        const scanner = yara.createScanner();
        try {
          const yararules = await YaraModel.find();
          const rules = yararules.map((yararule: any) => yararule.rule);
          const ruleString = rules.join('\n');

          const options = { rules: [{ string: ruleString }] };

          scanner.configure(options, (error: Error | null, warnings: any[]) => {
            if (error) {
              logger.error(error.message);
              reject(null);
            } else {
              if (warnings.length) {
                logger.debug('Compile warnings: ' + JSON.stringify(warnings));
              }

              try {
                const buf = { buffer: Buffer.from(source, 'utf-8') };
                scanner.scan(
                  buf,
                  (error: Error | null, result: YaraScanResult) => {
                    if (error) {
                      logger.error(`Scan failed: ${error.message}`);
                      reject(null);
                    } else {
                      if (result.rules.length) {
                        logger.debug(`Matched: ${JSON.stringify(result)}`);
                      }
                      resolve(result);
                    }
                  },
                );
              } catch (err) {
                logger.error(err);
                reject(null);
              }
            }
          });
        } catch (err) {
          logger.error(err);
          reject(null);
        }
      }
    });
  });
};

export const yaraSource = async (
  html: string,
): Promise<string | null | undefined> => {
  const yaraResult = await yaraScan(html);
  if (yaraResult?.rules.length) {
    const name = yaraResult.rules[0].id;
    const rule = await YaraModel.findOne({ name });
    if (rule) {
      //logger.debug(rule.actions);
      return rule.actions;
    }
  }
  return undefined;
};
