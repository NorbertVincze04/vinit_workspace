import { FieldMap, field, fromApi, toApi } from './api-fields';

interface Entry {
  id: string;
  createdAt: string;
  updatedAt: string;
  amount: number;
  date: string;
  accountId: string;
  tags: string[];
  done: boolean;
}

const FIELDS: FieldMap<Entry> = {
  amount: field.money('amountBani'),
  date: field.date(),
  accountId: field.ref(),
  tags: field.list(),
  done: field.bool(),
};

describe('api-fields', () => {
  it('converts RON to whole bani without float errors', () => {
    expect(toApi(FIELDS, { amount: 49.99 })).toEqual({ amountBani: 4999 });
    expect(toApi(FIELDS, { amount: 0.1 + 0.2 })).toEqual({ amountBani: 30 });
    expect(toApi(FIELDS, { amount: 1234.565 })['amountBani']).toBe(123457);
  });

  it('turns empty dates and links into null, and back into empty strings', () => {
    expect(toApi(FIELDS, { date: '', accountId: '' })).toEqual({ date: null, accountId: null });
    const entry = fromApi<Entry>(FIELDS, { id: 'tx1', amountBani: 15000, date: null, accountId: null, tags: null, done: true });
    expect(entry).toEqual(jasmine.objectContaining({ id: 'tx1', amount: 150, date: '', accountId: '', tags: [], done: true }));
  });

  it('only sends the fields that are in the patch', () => {
    expect(toApi(FIELDS, { done: true })).toEqual({ done: true });
  });

  it('keeps id and valid timestamps only when asked (backup import)', () => {
    const item = { id: 'a1', createdAt: '2026-11-07T10:00:00.000Z', updatedAt: 'not-a-date', done: false };
    expect(toApi(FIELDS, item)).toEqual({ done: false });
    expect(toApi(FIELDS, item, { meta: true })).toEqual({ done: false, id: 'a1', createdAt: '2026-11-07T10:00:00.000Z' });
  });
});
