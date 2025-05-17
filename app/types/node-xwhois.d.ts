import "node-xwhois";

declare module "node-xwhois" {
  export function extractIP(host: string): Promise<string[]>;
  export function bgpInfo(ip: string, timeout: number): Promise<any[]>;
}
