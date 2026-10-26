declare module "word-extractor" {
  export default class WordExtractor {
    extract(buffer: Buffer): Promise<{ getBody(): string; getHeaders(): string; getFootnotes(): string; getEndnotes(): string; getTextboxes(): string }>;
  }
}
declare module "rtf-parser" {
  const parser: { string(input: string, callback: (error: Error | null, doc: { content: unknown[] }) => void): void };
  export default parser;
}
