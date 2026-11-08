import { tc } from './content';
import { countOf, lang, setLang, t } from './i18n';
import { RO } from './ro';
import { translateServer } from './server-messages';

describe('i18n', () => {
  afterEach(() => setLang('en', false));

  it('runs the specs in English and leaves texts as they are', () => {
    expect(lang()).toBe('en');
    expect(t('Save')).toBe('Save');
    expect(t('Year {n} added', { n: 2 })).toBe('Year 2 added');
    expect(countOf(1, 'day', 'days')).toBe('1 day');
    expect(countOf(3, 'day', 'days')).toBe('3 days');
  });

  it('translates to Romanian, with Romanian plurals', () => {
    setLang('ro', false);
    expect(t('Save')).toBe('Salvează');
    expect(t('{label} is required.', { label: 'Titlu' })).toBe('Câmpul „Titlu” este obligatoriu.');
    expect(countOf(1, 'day', 'days')).toBe('1 zi');
    expect(countOf(3, 'day', 'days')).toBe('3 zile');
    expect(countOf(20, 'day', 'days')).toBe('20 de zile');
    // Unknown texts stay as written (user content, names).
    expect(t('Barber House')).toBe('Barber House');
  });

  it('translates what the server writes, including texts with values', () => {
    setLang('ro', false);
    expect(translateServer('Wrong email or password.')).toBe('E-mail sau parolă greșită.');
    expect(translateServer('Year 3 has 2 content items: delete or move them first.')).toBe('Anul 3 are 2 materiale de conținut: șterge-le sau mută-le mai întâi.');
    expect(translateServer('Barber House: Subscription is past due')).toBe('Barber House: Abonamentul este restant');
    expect(translateServer('Domain barberhouse.ro expires')).toBe('Domeniul barberhouse.ro expiră');
    expect(translateServer('Something nobody wrote a pattern for')).toBe('Something nobody wrote a pattern for');
  });

  it('shows built-in content in the language until it is edited', () => {
    setLang('ro', false);
    expect(tc('Register the SRL and cover GDPR basics')).toBe('Înregistrează SRL-ul și acoperă elementele de bază GDPR');
    expect(tc('Register the SRL and cover GDPR basics today')).toBe('Register the SRL and cover GDPR basics today');
    setLang('en', false);
    // The business plan's keywords are Romanian originals.
    expect(tc('comisioane')).toBe('commissions');
  });

  it('has a Romanian text for every key, with the same placeholders', () => {
    for (const [en, ro] of Object.entries(RO)) {
      expect(ro.trim()).withContext(en).not.toBe('');
      const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
      expect(names(ro)).withContext(en).toBe(names(en));
    }
  });
});
