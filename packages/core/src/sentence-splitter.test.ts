import { describe, it, expect } from 'vitest';
import { SentenceSplitter } from './sentence-splitter.js';

describe('SentenceSplitter', () => {
  it('splits on periods followed by whitespace', () => {
    const splitter = new SentenceSplitter();
    const result = splitter.push('Hello world. How are you today?');
    expect(result).toEqual(['Hello world.', 'How are you today?']);
  });

  it('does not split on abbreviations like Dr. or Mr.', () => {
    const splitter = new SentenceSplitter();
    const r1 = splitter.push('Dr. Smith arrived at 5 p.m. today. ');
    expect(r1).toEqual(['Dr. Smith arrived at 5 p.m. today.']);
  });

  it('does not split on decimal numbers', () => {
    const splitter = new SentenceSplitter();
    const r1 = splitter.push('The value is 3.14 approximately. ');
    expect(r1).toEqual(['The value is 3.14 approximately.']);
  });

  it('flushes remaining buffer', () => {
    const splitter = new SentenceSplitter();
    splitter.push('This is an incomplete thought');
    const flushed = splitter.flush();
    expect(flushed).toEqual(['This is an incomplete thought']);
  });

  it('handles Hindi/Marathi danda (।)', () => {
    const splitter = new SentenceSplitter();
    const r = splitter.push('नमस्ते। आप कैसे हैं?');
    expect(r).toEqual(['नमस्ते।', 'आप कैसे हैं?']);
  });
});

