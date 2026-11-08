import { EntityData } from '../../../core/models';
import { FieldDef, FormValues, asList, asNumber, asString } from '../../../shared/ui';
import { FORMATS, PLATFORMS, POST_STATUSES } from './marketing.data';
import { MarketingStrategy, Post, PostStatus } from './marketing.model';
import { t } from '../../../core/i18n/i18n';
import { tc } from '../../../core/i18n/content';

/**
 * Fields of the content dialog (4-column grid).
 * @param monthLabel plan month → calendar label, e.g. 1 → "Dec 2026"
 * @param defaultMonth month pre-selected for a new item
 * @param strategy months (keywords) and channels of the marketing strategy
 */
export function postFields(monthLabel: (n: number) => string, defaultMonth: number, strategy: MarketingStrategy): readonly FieldDef[] {
  const months = strategy.months;
  const monthKeywords = (month: number): string => months[month - 1]?.keywords.map(tc).join(', ') ?? '';
  const isDefaultKeywords = (value: string): boolean => !value || months.some((m) => m.keywords.map(tc).join(', ') === value);
  return [
    { key: 'title', label: 'Title', type: 'text', required: true, span: 'full', placeholder: 'Reel: waitlist demo' },
    {
      key: 'month',
      label: 'Month',
      type: 'select',
      required: true,
      default: String(defaultMonth),
      options: months.map((_, i) => ({ value: String(i + 1), label: `M${i + 1} · ${monthLabel(i + 1)}` })),
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
        ...[1, 2, 3, 4].map((w) => ({ value: String(w), label: t('Week {n}', { n: w }) })),
      ],
    },
    { key: 'date', label: 'Exact date', type: 'date', span: 2 },
    { key: 'format', label: 'Format', type: 'select', default: 'post', options: FORMATS, span: 2 },
    {
      key: 'mix',
      label: 'Channel',
      type: 'select',
      default: (strategy.channels.find((c) => c.key === 'social') ?? strategy.channels[0])?.key ?? '',
      span: 2,
      options: strategy.channels.map((c) => ({ value: c.key, label: `${tc(c.label)} (${c.target}%)` })),
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

/** Form values → item data. The year isn't in the form: new items go to the selected year. */
export function postFromForm(v: FormValues): Omit<EntityData<Post>, 'year'> {
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
