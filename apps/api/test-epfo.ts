import 'pdf-parse/worker';
import { PDFParse, VerbosityLevel } from 'pdf-parse';
import * as fs from 'fs';

async function main() {
  const buffer = fs.readFileSync('/Users/yaft/Code/YAFT-private-inputs/epfo_passbook.pdf');
  const parser = new PDFParse({ data: Uint8Array.from(buffer), verbosity: VerbosityLevel.ERRORS });
  const text = await parser.getText();
  // dump full raw text
  console.log(text.pages[0].text);
  await parser.destroy().catch(() => {});
}
main().catch(console.error);
