import { useCallback, useState, type SyntheticEvent } from 'react';
import { Button, InlineNotification, PasswordInput, TextInput } from '@carbon/react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.js';

export const LoginPage = (): React.ReactNode => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('operations@warehouse.local');
  const [password, setPassword] = useState('LocalOperations123!');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = useCallback(
    async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setPending(true);
      setError(null);
      try {
        await login(email, password);
        await navigate('/dashboard', { replace: true });
      } catch (caught: unknown) {
        setError(caught instanceof Error ? caught.message : 'Login failed.');
      } finally {
        setPending(false);
      }
    },
    [email, password, login, navigate],
  );

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <main className="login-shell">
      <section className="login-intro" aria-labelledby="login-title">
        <p className="product-label">Warehouse Control Tower</p>
        <h1 id="login-title">Operational clarity when the workflow fails.</h1>
        <p>
          Monitor orders, trace incidents, and recover asynchronous processing from one local
          platform.
        </p>
      </section>
      <section className="login-panel" aria-label="Sign in">
        <h2>Sign in</h2>
        <p>Use a seeded local account to enter the operations workspace.</p>
        {error ? (
          <InlineNotification
            kind="error"
            title="Authentication failed"
            subtitle={error}
            lowContrast
            hideCloseButton
          />
        ) : null}
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <TextInput
            id="email"
            labelText="Email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.currentTarget.value);
            }}
            autoComplete="username"
            required
          />
          <PasswordInput
            id="password"
            labelText="Password"
            value={password}
            onChange={(event) => {
              setPassword(event.currentTarget.value);
            }}
            autoComplete="current-password"
            required
          />
          <Button type="submit" disabled={pending}>
            {pending ? 'Signing in...' : 'Enter control tower'}
          </Button>
        </form>
      </section>
    </main>
  );
};
