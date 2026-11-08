import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { formatDate } from '../../../../../core/utils/date';
import { formatNumber } from '../../../../../core/utils/format';
import {
  BadgeComponent,
  ButtonComponent,
  LedgerRowComponent,
  SelectFieldComponent,
} from '../../../../../shared/ui';
import { FORMATS, POST_STATUSES, labelOf } from '../../marketing.data';
import { Channel, Post, PostStatus } from '../../marketing.model';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { t } from '../../../../../core/i18n/i18n';
import { tc } from '../../../../../core/i18n/content';

/** One content item: format, title, meta, quick status change and expandable details. */
@Component({
  selector: 'app-post-item',
  standalone: true,
  imports: [TPipe, LedgerRowComponent, BadgeComponent, ButtonComponent, SelectFieldComponent],
  templateUrl: './post-item.component.html',
  styleUrl: './post-item.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostItemComponent {
  readonly post = input.required<Post>();
  readonly expanded = input(false, { transform: booleanAttribute });
  /** The strategy's channels (to name the item's channel). */
  readonly channels = input<readonly Channel[]>([]);

  readonly expandedChange = output<boolean>();
  readonly statusChange = output<PostStatus>();
  readonly edit = output<void>();
  readonly duplicate = output<void>();
  readonly remove = output<void>();
  readonly copyCaption = output<void>();

  protected readonly statusOptions = POST_STATUSES;
  protected readonly format = computed(() => t(labelOf(FORMATS, this.post().format) || 'Item'));
  protected readonly when = computed(() => {
    const p = this.post();
    return [p.week ? t('Week {n}', { n: p.week }) : '', formatDate(p.date, { day: 'numeric', month: 'short' })]
      .filter(Boolean)
      .join(' · ');
  });
  protected readonly meta = computed(() => {
    const p = this.post();
    const bits: string[] = [];
    if (p.platforms.length) bits.push(p.platforms.join(', '));
    if (p.count > 1) bits.push(t('×{n} appearances', { n: p.count }));
    if (p.budget > 0) bits.push(t('{amount} RON ad spend', { amount: formatNumber(p.budget) }));
    if (p.mix) bits.push(tc(this.channels().find((c) => c.key === p.mix)?.label ?? p.mix));
    return bits;
  });
  protected readonly details = computed(() =>
    [
      { label: 'Visual brief', value: this.post().visual },
      { label: 'Call to action', value: this.post().cta },
      { label: 'Keywords', value: this.post().keywords },
      { label: 'Notes', value: this.post().notes },
    ].filter((d) => d.value),
  );

  protected setStatus(value: string): void {
    this.statusChange.emit(value as PostStatus);
  }
}
