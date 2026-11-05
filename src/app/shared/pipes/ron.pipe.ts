import { Pipe, PipeTransform } from '@angular/core';
import { formatRon } from '../../core/utils/format';

/**
 * {{ 6380 | ron }}          → "6.380 RON"
 * {{ -6380 | ron:'signed' }} → "−6.380 RON"
 */
@Pipe({ name: 'ron', standalone: true })
export class RonPipe implements PipeTransform {
  transform(value: number | null | undefined, mode: 'plain' | 'signed' = 'plain'): string {
    return value == null ? '' : formatRon(value, mode === 'signed');
  }
}
