import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { apiError } from '../../core/api/api.service';
import { safeNext } from '../../core/auth/auth.guard';
import { AuthService } from '../../core/auth/auth.service';
import { ButtonComponent, CardComponent, LogoComponent, TextFieldComponent } from '../../shared/ui';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Sign-in page (the only page reachable without a session). */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ButtonComponent, CardComponent, LogoComponent, TextFieldComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly errors = signal<{ email?: string; password?: string; form?: string }>({});
  protected readonly expired = this.route.snapshot.queryParamMap.get('expired') === '1';

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;

    const email = this.email().trim();
    const errors: { email?: string; password?: string } = {};
    if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
    if (!this.password()) errors.password = 'Enter your password.';
    this.errors.set(errors);
    if (errors.email || errors.password) return;

    this.busy.set(true);
    try {
      await this.auth.login(email, this.password());
      await this.router.navigateByUrl(safeNext(this.route.snapshot.queryParamMap.get('next')));
    } catch (error) {
      const e = apiError(error);
      this.errors.set({ ...(e.fields ?? {}), form: e.message });
      this.password.set('');
    } finally {
      this.busy.set(false);
    }
  }
}
