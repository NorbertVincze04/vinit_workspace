import { parseCsv } from '../../../core/utils/file';
import { leadsFromTable } from './leads.import';

describe('lead import', () => {
  it('reads Excel CSV with ";" separators, quotes and a BOM', () => {
    const rows = parseCsv('﻿Name;Notes\r\n"A; B";"He said ""yes"""\r\n\r\nC;\n');
    expect(rows).toEqual([
      ['Name', 'Notes'],
      ['A; B', 'He said "yes"'],
      ['C', ''],
    ]);
  });

  it('maps the prospect-list columns and keeps the extra ones in the notes', () => {
    const table = parseCsv(
      'Business Name,Email,Phone,Employees,Service,Billing,Notes,Status,Website,Location,Social media\n' +
        'Barber Unu,unu@test.ro,0711,3,Barbershop,Lunar,Likes it,Contactat,,Satu Mare,@unu\n' +
        'Salon Doi,not-an-email,,many,,,,,doi.ro,Pitesti,\n' +
        ',x@y.ro,,,,,,,,,\n',
    );
    const { rows, withoutName, mapping } = leadsFromTable(table);
    expect(withoutName).toBe(1);
    expect(rows[0]).toEqual({
      businessName: 'Barber Unu',
      email: 'unu@test.ro',
      phone: '0711',
      employees: 3,
      services: 'Barbershop',
      city: 'Satu Mare',
      instagram: '@unu',
      notes: 'Likes it\nBilling: Lunar\nStatus: Contactat',
      source: 'other',
    });
    // An invalid email or staff count never blocks the import.
    expect(rows[1]).toEqual({ businessName: 'Salon Doi', website: 'doi.ro', city: 'Pitesti', notes: 'Email: not-an-email', source: 'other' });
    expect(mapping.find((m) => m.header === 'Location')?.field).toBe('city');
  });
});
