import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Lead, LeadStage } from '../../leads.model';
import { LeadColumn } from '../../leads.store';
import { LeadCardComponent } from '../lead-card/lead-card.component';
import { TPipe } from '../../../../../core/i18n/t.pipe';

export interface LeadDrop {
  lead: Lead;
  stage: LeadStage;
  /** Index among the cards shown in the target column. */
  index: number;
}

/**
 * Kanban board: one column per stage, cards dragged between columns (mouse, or a short press on
 * touch screens so the board can still scroll sideways). The page decides what a drop means:
 * Trial or Paying opens "Convert to salon", Lost asks why, a converted lead stays where it is.
 */
@Component({
  selector: 'app-lead-board',
  standalone: true,
  imports: [TPipe, CdkDropListGroup, CdkDropList, CdkDrag, CdkScrollable, LeadCardComponent],
  template: `
    <!-- cdkScrollable: the board scrolls sideways by itself while a card is dragged near its edge. -->
    <div class="board" cdkDropListGroup cdkScrollable>
      @for (col of columns(); track col.stage) {
        <section class="col" [attr.aria-label]="col.label">
          <header>
            <span class="title">{{ col.label | t }}</span>
            <span class="n">{{ col.leads.length }}</span>
          </header>
          <div
            class="list"
            cdkDropList
            [cdkDropListData]="col.stage"
            (cdkDropListDropped)="drop($event)"
          >
            @for (lead of col.leads; track lead.id) {
              <app-lead-card
                cdkDrag
                [cdkDragData]="lead"
                [cdkDragStartDelay]="{ touch: 250, mouse: 0 }"
                [lead]="lead"
                tabindex="0"
                role="button"
                [attr.aria-label]="'Open ' + lead.businessName"
                (click)="open.emit(lead)"
                (keydown.enter)="open.emit(lead)"
              />
            } @empty {
              <p class="empty">{{ col.hint }}</p>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .board { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(230px, 1fr); gap: 12px;
      overflow-x: auto; padding-bottom: 8px; overscroll-behavior-x: contain; scroll-snap-type: x proximity; }
    .col { display: flex; flex-direction: column; min-width: 0; background: var(--hover); border-radius: var(--radius-lg);
      padding: 10px; scroll-snap-align: start; }
    header { display: flex; align-items: center; gap: 8px; padding: 2px 4px 10px; }
    .title { font-size: 13.5px; font-weight: 600; }
    .n { font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
    .list { flex: 1; display: grid; align-content: start; gap: 8px; min-height: 80px; }
    .empty { font-size: 12.5px; color: var(--muted); padding: 8px 4px; }
    .cdk-drag-preview { box-shadow: var(--shadow-lg, 0 8px 24px rgb(0 0 0 / 0.18)); }
    .cdk-drag-placeholder { opacity: 0.35; }
    .cdk-drag-animating, .list.cdk-drop-list-dragging app-lead-card:not(.cdk-drag-placeholder) {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1); }
    @media (max-width: 640px) { .board { grid-auto-columns: 82%; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadBoardComponent {
  readonly columns = input.required<readonly LeadColumn[]>();
  readonly moved = output<LeadDrop>();
  readonly open = output<Lead>();

  protected drop(event: CdkDragDrop<LeadStage, LeadStage, Lead>): void {
    const lead = event.item.data;
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;
    this.moved.emit({ lead, stage: event.container.data, index: event.currentIndex });
  }
}
