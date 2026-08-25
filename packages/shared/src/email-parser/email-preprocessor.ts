/**
 * Stage 1: Document Preprocessing & Section Partitioning
 *
 * Cleans raw email text, decodes HTML entities, and partitions the content
 * into header, primary financial notification payload, and boilerplate disclaimers.
 */

export interface PreprocessedEmailDocument {
  raw: string;
  cleanedText: string;
  sender?: string;
  subject?: string;
  corePayload: string;
  disclaimerPayload: string;
  fullContext: string;
}

const HTML_ENTITIES: Array<[RegExp, string]> = [
  [/&#8377;|&inr;/gi, 'INR '],
  [/&#x20b9;/gi, 'INR '],
  [/&nbsp;/gi, ' '],
  [/&amp;/gi, '&'],
  [/&quot;/gi, '"'],
  [/&#39;|&apos;/gi, "'"],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
  [/<[^>]+>/g, ' '], // Strip HTML tags
];

const DISCLAIMER_SPLIT_REGEX = /(?:In\s+case\s+of\s+any\s+discrepancy|If\s+(?:this\s+was\s+not\s+done\s+by\s+you|you\s+did\s+not\s+(?:authorise|authorize|make|initiate)|you\s+have\s+not\s+done)|Please\s+do\s+not\s+share\s+OTP|Never\s+share\s+your\s+OTP|For\s+any\s+queries|Call\s+our\s+customer\s+care|This\s+is\s+a\s+system\s+generated\s+(?:mail|email|message)|Looking\s+forward\s+to\s+more\s+opportunities|Warm\s+regards|Sincerely,|Yours\s+faithfully|Axis\s+Bank\s+Customer\s+Care|State\s+Bank\s+of\s+India\s+Customer\s+Service|ICICI\s+Bank\s+Credit\s+Cards\s+Team)/i;

export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  let s = text;
  for (const [pattern, replacement] of HTML_ENTITIES) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

export function cleanEmailText(text: string): string {
  if (!text) return '';
  return decodeHtmlEntities(text)
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

export function preprocessEmailDocument(
  bodyText: string,
  senderOrSubject?: string
): PreprocessedEmailDocument {
  const cleanedText = cleanEmailText(bodyText);
  const fullContext = cleanEmailText(`${senderOrSubject || ''} ${cleanedText}`);

  let corePayload = cleanedText;
  let disclaimerPayload = '';

  const splitMatch = cleanedText.match(DISCLAIMER_SPLIT_REGEX);
  if (splitMatch && splitMatch.index !== undefined && splitMatch.index > 20) {
    corePayload = cleanedText.slice(0, splitMatch.index).trim();
    disclaimerPayload = cleanedText.slice(splitMatch.index).trim();
  }

  return {
    raw: bodyText,
    cleanedText,
    sender: senderOrSubject,
    subject: senderOrSubject,
    corePayload,
    disclaimerPayload,
    fullContext,
  };
}
