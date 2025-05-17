import * as fs from 'fs';

async function harparse(pageId: string): Promise<void> {
  const dataDir = `/tmp/${pageId}`;
  //const dataDir = '/tmp';
  const recordHar = `${dataDir}/pw.har`;
  console.log(recordHar);
  try {
    const har = JSON.parse(fs.readFileSync(recordHar, 'utf-8'));
    const entries = har.log.entries;
    for (const entry of entries) {
      const request = entry.request;
      const response = entry.response;
      console.log(request);
    }
  } catch (error) {
    console.log(error);
  }
  return;
}

export default harparse;
