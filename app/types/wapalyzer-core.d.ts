import "wapalyzer-core";

declare module "wapalyzer-core" {
  export class Wappalyzer {
    static setTechnologies(technologies: any): void;
    static setCategories(categories: any): void;
    static analyze(options: {
      url: string;
      headers: any;
      cookies: any;
      html: string;
    }): Promise<any>;
    static resolve(detections: any): any;
  }
}
