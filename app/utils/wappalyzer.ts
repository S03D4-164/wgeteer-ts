import {
  Wappalyzer as WappalyzerCore,
  //technologies,
  //categories,
} from './wapalyzer-core';
//import { Wappalyzer as WappalyzerCore } from "./wapalyzer-core";
import * as path from 'node:path';
import * as fs from 'fs';

const categories = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, `./webappanalyzer/src/categories.json`),
    'utf-8',
  ),
);
let technologies: any = {};
for (const index of Array(27).keys()) {
  const character = index ? String.fromCharCode(index + 96) : '_';
  technologies = {
    ...technologies,
    ...JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          `./webappanalyzer/src/technologies/${character}.json`,
        ),
        'utf-8',
      ),
    ),
  };
}
WappalyzerCore.setTechnologies(technologies);
WappalyzerCore.setCategories(categories);

const wapalyze = async (
  url: string,
  headers: any,
  html: string,
  cookies: any,
) => {
  let result: any;
  const parsedHeaders = await parseHeaders(headers);
  try {
    const detections = await WappalyzerCore.analyze({
      url: url,
      headers: parsedHeaders,
      cookies: cookies,
      html: html,
    });

    result = WappalyzerCore.resolve(detections);
  } catch (error: any) {
    console.error('Error analyzing website:', error);
  }
  //console.log(result);
  return result;
};

async function parseHeaders(headers: any) {
  let parsedHeaders: any = {};
  for (let header of headers) {
    parsedHeaders[header.name.toLowerCase()] = [header.value];
  }
  //console.log(parsedHeaders);
  return parsedHeaders;
}

async function analyzeResponses(responses: any) {
  for (let res of responses) {
    if (res.url && res.text) {
      let cookies;
      const results = await wapalyze(res.url, res.headers, res.text, cookies);
      let wapps = [];
      for (let result of results) {
        if (result.confidence == 100) {
          wapps.push(result.name);
        }
      }
      if (wapps) res.wappalyzer = wapps;
    }
  }
  return responses;
}

async function analyzePage(webpage: any) {
  if (webpage.url && webpage.content) {
    let cookies;
    const results = await wapalyze(
      webpage.url,
      webpage.headers,
      webpage.content,
      cookies,
    );
    let wapps = [];
    for (let result of results) {
      if (result.confidence == 100) {
        wapps.push(result.name);
      }
    }
    return wapps;
  }
  return undefined;
}
export { analyzePage, analyzeResponses };
