import { Pipe, PipeTransform } from '@angular/core';
import { tc } from './content';

/** Built-in content in the app's language until it is edited: {{ task.text | tc }}. */
@Pipe({ name: 'tc', standalone: true })
export class TcPipe implements PipeTransform {
  transform(text: string | null | undefined): string {
    return tc(text);
  }
}
