import { Wappalyzer as WappalyzerCore } from 'wapalyzer-core';
//import { Wappalyzer as WappalyzerCore } from "./wapalyzer-core";
import * as path from 'node:path';
import * as fs from 'fs';

const wapalyze = async (
  url: string,
  headers: any,
  html: string,
  cookies: any,
) => {
  let result: any;
  try {
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

    const detections = await WappalyzerCore.analyze({
      url: url,
      headers: headers,
      cookies: cookies,
      html: html,
    });

    result = WappalyzerCore.resolve(detections);
  } catch (error: any) {
    console.error('Error analyzing website:', error);
  }
  return result;
};

export default wapalyze;
