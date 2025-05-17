import { IP2Location } from "ip2location-nodejs";

declare module "ip2location-nodejs" {
  export class IP2Location {
    constructor();
    open(databasePath: string): void;
    getCountryShort(ip: string): string;
    getCountryLong(ip: string): string;
  }
}
