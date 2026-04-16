import { AssetLoader, assetLoaders } from "./loader";

export class JsonLoader implements AssetLoader<any> {
  type = "json";
  extensions = [".json"];

  async load(path: string, data: ArrayBuffer | string): Promise<any> {
    const text = typeof data === "string" ? data : new TextDecoder("utf-8").decode(data);
    return JSON.parse(text);
  }
}

assetLoaders.register(new JsonLoader());
