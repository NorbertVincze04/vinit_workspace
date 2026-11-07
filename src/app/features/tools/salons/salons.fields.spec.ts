import { FieldDef } from '../../../shared/ui';
import { newSalonBody, newSalonFields } from './salons.fields';

describe('salon form', () => {
  it('sends a new client with the salon, cleaning the domain and defaulting the client city', () => {
    const body = newSalonBody({
      name: 'Frizeria Ardeal',
      city: 'Cluj-Napoca',
      status: 'trial',
      planId: '',
      domain: 'https://FrizeriaArdeal.ro/',
      clientId: 'new',
      'client.kind': 'company',
      'client.name': 'Ardeal SRL',
      'client.businessAddress': 'Str. Horea 12',
      'client.city': '',
      notes: '',
    });
    expect(body).toEqual(
      jasmine.objectContaining({ name: 'Frizeria Ardeal', planId: null, domain: 'frizeriaardeal.ro', status: 'trial' }),
    );
    expect(body['client']).toEqual(jasmine.objectContaining({ name: 'Ardeal SRL', businessAddress: 'Str. Horea 12', city: 'Cluj-Napoca' }));
    expect(body['clientId']).toBeUndefined();
  });

  it('links an existing client instead of creating one', () => {
    const body = newSalonBody({ name: 'X', clientId: 'c-1', domain: '' });
    expect(body['clientId']).toBe('c-1');
    expect(body['client']).toBeUndefined();
    expect(body['domain']).toBeUndefined();
  });

  it('shows the client fields only for a new client and validates the domain', () => {
    const fields = newSalonFields([], []);
    const byKey = (k: string): FieldDef => fields.find((f) => f.key === k)!;
    expect(byKey('client.name').show!({ clientId: 'new' })).toBeTrue();
    expect(byKey('client.name').show!({ clientId: 'c-1' })).toBeFalse();
    expect(byKey('domain').validate!('not a domain', {})).toContain('domain');
    expect(byKey('domain').validate!('barberhouse.ro', {})).toBeNull();
  });
});
