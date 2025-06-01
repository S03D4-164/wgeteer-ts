import ResponseModel from '../models/response';
import * as whois from './node-xwhois';
import { IP2Location } from './ip2location-nodejs';
import logger from './logger';
import net from 'net';
import { promises as dns } from 'dns';

interface GeoIPInfo {
  country?: string;
  country_long?: string;
}

interface HostInfo {
  reverse?: string[];
  bgp?: any[];
  geoip?: GeoIPInfo;
  ip?: string;
}

const getIpinfo = async (host: string): Promise<HostInfo | undefined> => {
  try {
    const ipArray: string[] | undefined = await whois.extractIP(host);
    const ip = ipArray ? ipArray[0] : undefined;

    if (ip && net.isIP(ip)) {
      let reverses: string[] = [];
      try {
        reverses = await dns.reverse(ip);
      } catch (err) {
        logger.error(err);
      }
      const hostnames = Array.from(new Set(reverses));

      let bgp: any[] | undefined;
      try {
        if (net.isIPv4(ip)) {
          let bgpInfo = await whois.bgpInfo(ip, 10000);
          bgp = [...new Set(bgpInfo.map((i: any) => JSON.stringify(i)))].map(
            (i: any) => JSON.parse(i),
          );
        }
      } catch (err) {
        logger.error(err);
      }

      let geo: GeoIPInfo = {};
      try {
        const ip2location: any = new IP2Location();
        ip2location.open('/tmp/IP2LOCATION-LITE-DB1.IPV6.BIN');
        const country = ip2location.getCountryShort(ip);
        const country_long = ip2location.getCountryLong(ip);
        geo = {
          country: country,
          country_long: country_long,
        };
      } catch (error: any) {
        logger.error('[GeoIP] error: ' + error.message);
      }

      const ipInfo: HostInfo = {
        reverse: hostnames,
        bgp: bgp,
        geoip: geo,
        ip: ip,
      };
      logger.info(ipInfo);
      return ipInfo;
    }
  } catch (err) {
    logger.error(err);
  }
  return undefined;
};

const setResponseIp = async (responses: any[]): Promise<any> => {
  const ips: { [key: string]: any[] } = {};
  for (const response of responses) {
    if (response.remoteAddress && response.remoteAddress.ip) {
      const ip = response.remoteAddress.ip;
      if (ips[ip]) {
        ips[ip].push(response);
      } else {
        ips[ip] = [response];
      }
    }
  }
  let resArray = [];
  for (const ip in ips) {
    const hostinfo = await getIpinfo(ip);
    if (hostinfo) {
      for (const res of ips[ip]) {
        const remoteAddress: any = {};
        if (hostinfo.reverse) remoteAddress.reverse = hostinfo.reverse;
        if (hostinfo.bgp) remoteAddress.bgp = hostinfo.bgp;
        if (hostinfo.geoip) remoteAddress.geoip = hostinfo.geoip;
        if (hostinfo.ip) remoteAddress.ip = hostinfo.ip;
        else remoteAddress.ip = ip;
        res.remoteAddress = remoteAddress;
        resArray.push(res);
        /*
        try {
          await ResponseModel.findOneAndUpdate(
            { _id: res._id },
            { remoteAddress: remoteAddress },
          ).exec();
        } catch (err) {
          logger.error(err);
        }
        */
      }
    }
  }
  return resArray;
};

export const getHostInfo = async (
  host: string,
): Promise<HostInfo | undefined> => {
  const hostinfo = await getIpinfo(host);
  return hostinfo;
};

export const setResponseIps = setResponseIp;
