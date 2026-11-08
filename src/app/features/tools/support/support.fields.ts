import { todayISO } from '../../../core/utils/date';
import { FieldDef, FormValues, SelectOption, asNumber, asString } from '../../../shared/ui';
import { CHANNELS, ENTRY_KINDS, PRIORITIES, TICKET_STATUSES, TICKET_TYPES, Ticket } from './support.model';
import { t } from '../../../core/i18n/i18n';

const options = (list: readonly { value: string; label: string }[]): SelectOption[] => list.map(({ value, label }) => ({ value, label }));

export function ticketFields(salons: readonly SelectOption[] | null, users: readonly SelectOption[], editing: boolean, me = ''): FieldDef[] {
  const fields: FieldDef[] = [];
  if (salons) fields.push({ key: 'salonId', label: 'Salon', type: 'select', required: true, span: 'full', options: [{ value: '', label: 'Pick a salon' }, ...salons] });
  fields.push(
    { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 300, span: 'full', placeholder: 'e.g. Booking page shows the wrong hours' },
    { key: 'type', label: 'Type', type: 'select', default: 'question', options: TICKET_TYPES },
    { key: 'priority', label: 'Priority', type: 'select', default: 'normal', options: options(PRIORITIES) },
    { key: 'reportedVia', label: 'Reported via', type: 'select', default: 'whatsapp', options: CHANNELS },
    { key: 'assigneeId', label: 'Assigned to', type: 'select', default: me, options: [{ value: '', label: 'Nobody' }, ...users] },
  );
  if (editing) fields.push({ key: 'status', label: 'Status', type: 'select', options: options(TICKET_STATUSES) });
  fields.push({ key: 'description', label: 'Details', type: 'textarea', span: 'full', placeholder: 'What happened, steps to see it, screenshots in Files' });
  return fields;
}

export function ticketBody(v: FormValues, editing: boolean): Record<string, unknown> {
  return {
    ...(v['salonId'] ? { salonId: asString(v['salonId']) } : {}),
    title: asString(v['title']),
    type: asString(v['type']) || 'question',
    priority: asString(v['priority']) || 'normal',
    reportedVia: asString(v['reportedVia']) || 'whatsapp',
    assigneeId: asString(v['assigneeId']) || null,
    description: asString(v['description']),
    ...(editing && v['status'] ? { status: asString(v['status']) } : {}),
  };
}

/** Log time. With `remaining` = 0 the included-session option explains why it's not available. */
export function timeFields(remaining: number | null, tickets: readonly Pick<Ticket, 'id' | 'number' | 'title'>[] | null): FieldDef[] {
  const kinds = ENTRY_KINDS.map((k) => ({
    value: k.value,
    label: k.value === 'included_session' && remaining !== null ? t('{kind} ({n} left)', { kind: t(k.label), n: remaining }) : k.label,
  }));
  const fields: FieldDef[] = [
    {
      key: 'kind',
      label: 'Type of time',
      type: 'select',
      span: 'full',
      default: remaining ? 'included_session' : 'billable',
      options: kinds,
      hint: 'Included sessions count per meeting. Billable time is charged per minute at 100 RON/h.',
    },
    { key: 'minutes', label: 'Minutes', type: 'number', required: true, integer: true, min: 1, max: 1440, default: 30, hint: 'At most 24 hours (1440 minutes) per entry.' },
    { key: 'workedOn', label: 'Date', type: 'date', required: true, default: todayISO, validate: (v) => (v > todayISO() ? 'That day is in the future.' : null) },
  ];
  if (tickets?.length) {
    fields.push({
      key: 'ticketId',
      label: 'Ticket',
      type: 'select',
      span: 'full',
      options: [{ value: '', label: 'No ticket' }, ...tickets.map((t) => ({ value: t.id, label: `T-${String(t.number).padStart(4, '0')} ${t.title}` }))],
    });
  }
  fields.push({ key: 'description', label: 'What was done', type: 'textarea', span: 'full', maxLength: 2000, placeholder: 'e.g. Changed the opening hours and added two barbers' });
  return fields;
}

export function timeBody(v: FormValues): Record<string, unknown> {
  return {
    kind: asString(v['kind']) || 'billable',
    minutes: Math.round(asNumber(v['minutes'])),
    workedOn: asString(v['workedOn']),
    ...(v['ticketId'] !== undefined ? { ticketId: asString(v['ticketId']) || null } : {}),
    description: asString(v['description']),
  };
}
