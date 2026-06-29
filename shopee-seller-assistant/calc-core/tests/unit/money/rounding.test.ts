import { describe, expect, it } from 'vitest';
import { D, ceilToInt, roundHalfUpToInt } from '../../../src/money';

const dec = (s: string) => new D(s);

describe('roundHalfUpToInt', () => {
  it('rounds down below .5', () => {
    expect(roundHalfUpToInt(dec('1043.48')).toString()).toBe('1043');
    expect(roundHalfUpToInt(dec('2086.96')).toString()).toBe('2087');
  });

  it('rounds half up at exactly .5 (ties away from zero)', () => {
    expect(roundHalfUpToInt(dec('1043.5')).toString()).toBe('1044');
    expect(roundHalfUpToInt(dec('0.5')).toString()).toBe('1');
    expect(roundHalfUpToInt(dec('-0.5')).toString()).toBe('-1');
  });

  it('leaves whole numbers unchanged', () => {
    expect(roundHalfUpToInt(dec('8000')).toString()).toBe('8000');
  });
});

describe('ceilToInt', () => {
  it('rounds up any fractional part', () => {
    expect(ceilToInt(dec('52173.91')).toString()).toBe('52174');
    expect(ceilToInt(dec('84782.6')).toString()).toBe('84783');
    expect(ceilToInt(dec('77419.35')).toString()).toBe('77420');
    expect(ceilToInt(dec('105978.75')).toString()).toBe('105979');
  });

  it('leaves whole numbers unchanged', () => {
    expect(ceilToInt(dec('52174')).toString()).toBe('52174');
  });
});

describe('isolated Decimal constructor (D)', () => {
  it('does not emit exponential notation in range', () => {
    expect(dec('1000000000000').toString()).toBe('1000000000000');
    expect(dec('0.0001').toString()).toBe('0.0001');
  });
});
