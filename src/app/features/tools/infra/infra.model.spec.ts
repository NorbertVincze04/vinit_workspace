import { backupTone, optionalAmount, parseOptionalAmount, serviceBody } from './infra.model';

describe('infra', () => {
  it('keeps an empty optional amount empty, and checks the format', () => {
    expect(optionalAmount('25')).toBeNull();
    expect(optionalAmount('2,50')).toBeNull();
    expect(optionalAmount('2,505')).toContain('amount');
    expect(optionalAmount('abc')).toContain('amount');
    expect(parseOptionalAmount('')).toBeNull();
    expect(parseOptionalAmount('2,5')).toBe(2.5);
    expect(parseOptionalAmount('0')).toBe(0);
  });

  it('takes no estimate when the cost comes from Finances (decision G)', () => {
    expect(serviceBody({ name: 'Twilio', recurringId: 'rc1', monthlyCost: '300' })).toEqual(jasmine.objectContaining({ recurringId: 'rc1', monthlyCostBani: null }));
    expect(serviceBody({ name: 'Domain', recurringId: '', monthlyCost: '2,5', currency: 'EUR' })).toEqual(
      jasmine.objectContaining({ recurringId: null, monthlyCostBani: 250, currency: 'EUR' }),
    );
    expect(serviceBody({ name: 'Free tool', recurringId: '', monthlyCost: '' })['monthlyCostBani']).toBeNull();
  });

  it('rates backup age: ok within a week, warning after, bad after a month or never', () => {
    expect(backupTone(2, 7, 30)).toBe('ok');
    expect(backupTone(12, 7, 30)).toBe('warn');
    expect(backupTone(45, 7, 30)).toBe('bad');
    expect(backupTone(null, 7, 30)).toBe('bad');
  });
});
