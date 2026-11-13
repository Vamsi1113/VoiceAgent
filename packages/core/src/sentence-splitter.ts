/**
 * Sentence splitter for the TTS pipeline.
 * Splits streamed LLM text into complete sentences suitable for TTS.
 * Rules: split on '. ? ! ।' followed by whitespace or end;
 * do not split on abbreviations (Mr., Dr., etc.) or decimals (3.14);
 * cap very long sentences at ~200 chars on a comma.
 */

const ABBREVS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'vs',
  'etc',
  'e.g',
  'i.e',
  'fig',
  'vol',
  'dept',
  'est',
  'am',
  'pm',
  'p.m',
  'a.m',
]);

const MAX_SENTENCE_LENGTH = 120;

function isAbbreviation(text: string, dotIndex: number): boolean {
  const before = text.slice(0, dotIndex);
  const word = before.split(/\s+/).pop()?.toLowerCase() ?? '';
  return ABBREVS.has(word) || /^\d+$/.test(word) || /^[a-z]\.[a-z]$/i.test(word) || /^[a-z]$/i.test(word);
}

export class SentenceSplitter {
  private buffer = '';
  private sentences: string[] = [];

  push(chunk: string): string[] {
    this.buffer += chunk;
    const result: string[] = [];

    while (true) {
      let searchOffset = 0;
      let foundIndex = -1;

      while (searchOffset < this.buffer.length) {
        const remaining = this.buffer.slice(searchOffset);
        const match = remaining.match(/[.?!।](?:\s|$)/);
        if (!match || match.index === undefined) break;

        const idx = searchOffset + match.index;
        const char = this.buffer[idx] ?? '';

        if (char === '.' && isAbbreviation(this.buffer, idx)) {
          searchOffset = idx + 1;
        } else {
          foundIndex = idx;
          break;
        }
      }

      if (foundIndex === -1) break;

      const sentence = this.buffer.slice(0, foundIndex + 1).trim();
      this.buffer = this.buffer.slice(foundIndex + 1).trimStart();

      if (sentence.length > MAX_SENTENCE_LENGTH) {
        const parts = this.capLong(sentence);
        result.push(...parts);
      } else if (sentence) {
        result.push(sentence);
      }
    }

    if (this.buffer.length > MAX_SENTENCE_LENGTH) {
      const parts = this.capLong(this.buffer);
      const last = parts.pop();
      result.push(...parts);
      this.buffer = last ?? '';
    }

    return result;
  }

  /** Flush remaining buffer (called at turn end). */
  flush(): string[] {
    const remaining = this.buffer.trim();
    this.buffer = '';
    return remaining ? [remaining] : [];
  }

  private capLong(text: string): string[] {
    if (text.length <= MAX_SENTENCE_LENGTH) return [text];
    const parts: string[] = [];
    let remainder = text;
    while (remainder.length > MAX_SENTENCE_LENGTH) {
      // Find last comma before MAX_SENTENCE_LENGTH
      const slice = remainder.slice(0, MAX_SENTENCE_LENGTH);
      const lastComma = slice.lastIndexOf(',');
      if (lastComma > 0) {
        parts.push(remainder.slice(0, lastComma + 1).trim());
        remainder = remainder.slice(lastComma + 1).trimStart();
      } else {
        // No comma, hard-cut
        parts.push(slice.trim());
        remainder = remainder.slice(MAX_SENTENCE_LENGTH).trimStart();
      }
    }
    if (remainder) parts.push(remainder);
    return parts;
  }
}

