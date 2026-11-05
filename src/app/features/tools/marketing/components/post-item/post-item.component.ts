import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { formatDate } from '../../../../../core/utils/date';
import { formatNumber } from '../../../../../core/utils/format';
import {
  BadgeComponent,
  ButtonComponent,
  LedgerRowComponent,
  SelectFieldComponent,
} from '../../../../../shared/ui';
import { FORMATS, MIX, POST_STATUSES, labelOf } from '../../marketing.data';
import { Post, PostStatus } from '../../marketing.model';

/** One content item: format, title, meta, quick status change and expandable details. */
@Component({
  selector: 'app-post-item',
  standalone: true,
  imports: [LedgerRowComponent, BadgeComponent, ButtonComponent, SelectFieldComponent],
  templateUrl: './post-item.component.html',
  styleUrl: './post-item.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostItemComponent {
  readonly post = input.required<Post>();
  readonly expanded = input(false, { transform: booleanAttribute });

  readonly expandedChange = output<boolean>();
  readonly statusChange = output<PostStatus>();
  readonly edit = output<void>();
  readonly duplicate = output<void>();
  readonly remove = output<void>();
  readonly copyCaption = output<void>();

  protected readonly statusOptions = POST_STATUSES;
  protected readonly format = computed(() => labelOf(FORMATS, this.post().format) || 'Item');
  protected readonly when = computed(() => {
    const p = this.post();
    return [p.week ? `Week ${p.week}` : '', formatDate(p.date, { day: 'numeric', month: 'short' })]
      .filter(Boolean)
      .join(' · ');
  });
  protected readonly meta = computed(() => {
    const p = this.post();
    const bits: string[] = [];
    if (p.platforms.length) bits.push(p.platforms.join(', '));
    if (p.count > 1) bits.push(`×${p.count} appearances`);
    if (p.budget > 0) bits.push(`${formatNumber(p.budget)} RON ad spend`);
    if (p.mix) bits.push(labelOf(MIX, p.mix));
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
