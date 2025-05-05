/*
https://www.npmjs.com/package/antibotbrowser
*/

import { execFile } from 'child_process';
import superagent from 'superagent';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function startbrowser(port: number, url: string): Promise<{ useragent: string; websocket: string } | any> {
  try {
    if (typeof port !== 'number') {
      port = 9515;
    }
    if (typeof url !== 'string') {
      url = 'https://google.com';
    }

    execFile(
      '/usr/bin/google-chrome-stable',
      [
        '--no-sandbox',
        '--window-size=1280,720',
        '--disable-setuid-sandbox',
        '--no-zygote',
        `--remote-debugging-port=${port}`,
        url,
      ],
      (err) => {
        console.log(err);
      },
    );
    await delay(4000);
    const res = await superagent.get(`http://127.0.0.1:${port}/json/version`);
    const veri = JSON.parse(res.text);
    const useragent = veri['User-Agent'];
    const websocket = veri['webSocketDebuggerUrl'];
    return { useragent, websocket };
  } catch (error: any) {
    console.error(error);
    return { error: error.message };
  }
}

export default {
  startbrowser,
};
