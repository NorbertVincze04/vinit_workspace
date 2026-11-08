import { Pipe, PipeTransform } from '@angular/core';
import { t } from './i18n';

/**
 * Translates an English UI text in a template (the language is fixed for the app's lifetime,
 * so the pipe can stay pure).
 *   {{ 'New deadline' | t }}     [label]="'Title' | t"     {{ 'Year {n}' | t: { n: y } }}
 */
@Pipe({ name: 't', standalone: true })
export class TPipe implements PipeTransform {
  transform(text: string | null | undefined, params?: Record<string, string | number>): string {
    return text ? t(text, params) : '';
  }
}
