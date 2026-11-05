import { EntityData } from '../../../core/models';
import { FieldDef, FormValues, asList, asNumber, asString } from '../../../shared/ui';
import { FORMATS, MIX, MONTH_PLAN, PLATFORMS, POST_STATUSES } from './marketing.data';
import { Post, PostStatus } from './marketing.model';

const monthKeywords = (month: number): string => MONTH_PLAN[month - 1]?.keywords.join(', ') ?? '';
const isDefaultKeywords = (value: string): boolean =>
  !value || MONTH_PLAN.some((m) => m.keywords.join(', ') === value);

/**
 * Fields of the content dialog (4-column grid).
 * @param monthLabel plan month → calendar label, e.g. 1 → "Dec 2026"
 * @param defaultMonth month pre-selected for a new item
 */
export function postFields(monthLabel: (n: number) => string, defaultMonth: number): readonly FieldDef[] {
  return [
    { key: 'title', label: 'Title', type: 'text', required: true, span: 'full', placeholder: 'Reel: waitlist demo' },
    {
      key: 'month',
      label: 'Month',
      type: 'select',
      required: true,
      default: String(defaultMonth),
      options: MONTH_PLAN.map((_, i) => ({ value: String(i + 1), label: `M${i + 1} · ${monthLabel(i + 1)}` })),
      // Keep the suggested keywords in step with the month, unless they were edited by hand.
      onChange: (v) =>
        isDefaultKeywords(asString(v['keywords'])) ? { keywords: monthKeywords(asNumber(v['month'])) } : {},
    },
    {
      key: 'week',
      label: 'Week',
      type: 'select',
      default: '0',
      options: [
        { value: '0', label: 'Any' },
        ...[1, 2, 3, 4].map((w) => ({ value: String(w), label: `Week ${w}` })),
      ],
    },
    { key: 'date', label: 'Exact date', type: 'date', span: 2 },
    { key: 'format', label: 'Format', type: 'select', default: 'post', options: FORMATS, span: 2 },
    {
      key: 'mix',
      label: 'Communication mix',
      type: 'select',
      default: 'social',
      span: 2,
      options: MIX.map((m) => ({ value: m.value, label: `${m.label} (${m.target}%)` })),
    },
    { key: 'platforms', label: 'Platforms', type: 'multi', span: 'full', options: PLATFORMS.map((p) => ({ value: p, label: p })) },
    { key: 'count', label: 'Appearances', type: 'number', default: 1, min: 1, integer: true },
    { key: 'budget', label: 'Ad spend (RON)', type: 'number', default: 0, integer: true },
    { key: 'status', label: 'Status', type: 'select', default: 'planned', options: POST_STATUSES, span: 2 },
    {
      key: 'caption',
      label: 'Caption / message copy',
      type: 'textarea',
      span: 'full',
      placeholder: 'The text that goes out with the post, ad, DM or email',
    },
    { key: 'visual', label: 'Visual brief', type: 'textarea', span: 'full', placeholder: 'What the image, video or slides show' },
    { key: 'cta', label: 'Call to action', type: 'text', span: 2 },
    { key: 'keywords', label: 'Keywords', type: 'text', span: 2, default: monthKeywords(defaultMonth) },
    { key: 'hashtags', label: 'Hashtags', type: 'text', span: 'full', placeholder: '#barbershop #cluj' },
    { key: 'notes', label: 'Notes', type: 'textarea', span: 'full', placeholder: 'Targeting, timing, who to tag, results' },
  ];
}

export function postFromForm(v: FormValues): EntityData<Post> {
  return {
    title: asString(v['title']),
    month: asNumber(v['month']) || 1,
    week: asNumber(v['week']),
    date: asString(v['date']),
    format: asString(v['format']),
    mix: asString(v['mix']),
    platforms: asList(v['platforms']),
    count: Math.max(1, asNumber(v['count'])),
    budget: Math.max(0, asNumber(v['budget'])),
    status: (asString(v['status']) || 'planned') as PostStatus,
    caption: asString(v['caption']),
    visual: asString(v['visual']),
    cta: asString(v['cta']),
    keywords: asString(v['keywords']),
    hashtags: asString(v['hashtags']),
    notes: asString(v['notes']),
  };
}

/** Post → form values (month and week as select strings). */
export function postToForm(post: Post): FormValues {
  return {
    ...post,
    month: String(post.month),
    week: String(post.week || 0),
  } as unknown as FormValues;
}
