import superagent from 'superagent';
import WebsiteModel from '../models/website';

interface GSBResponse {
  matches?: any[];
  error?: string;
}

async function gsbLookup(url: string): Promise<GSBResponse> {
  const ApiEndpoint = 'http://127.0.0.1:3001/v4/threatMatches:find';
  const submit = {
    threatInfo: {
      threatEntries: [{ url: url }],
    },
  };

  try {
    console.log({ url: ApiEndpoint, body: submit });
    const res = await superagent
      .post(ApiEndpoint)
      .send(submit)
      .set('Content-Type', 'application/json');

    const body = res.body;
    console.log(body);

    if ('matches' in body) {
      return body;
    } else {
      return { matches: [] };
    }
  } catch (err: any) {
    return { error: err.message };
  }
}

async function lookupSite(id: string): Promise<GSBResponse> {
  try {
    const website: any = await WebsiteModel.findById(id);
    if (!website) {
      return { error: 'Website not found' };
    }
    const res = await gsbLookup(website.url);
    website.gsb.lookup = res;
    await website.save();
    return res;
  } catch (err: any) {
    console.log(err);
    return { error: err.message };
  }
}

async function lookupUrl(url: string): Promise<GSBResponse> {
  const res = await gsbLookup(url);
  return res;
}

export { lookupSite, lookupUrl };
