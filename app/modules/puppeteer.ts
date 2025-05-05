//import { addExtra } from 'puppeteer-extra';
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import rebrowserPuppeteer from 'rebrowser-puppeteer-core';

puppeteer.use(StealthPlugin());

export default puppeteer;
