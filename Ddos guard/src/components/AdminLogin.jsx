import { useState } from 'react';

export function AdminLogin({ busy, error, passwordConfigured, requiresPhpApi, onSubmit }) {
  const [password, setPassword] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit(password);
  }

  return (
    <section className="panel panel--feature">
      <div className="eyebrow">Вход</div>
      <h1>Панель управления</h1>
      <p className="panel-copy">Введите пароль для продолжения.</p>

      {requiresPhpApi ? <div className="form-error">Раздел временно недоступен.</div> : null}

      {!requiresPhpApi && !passwordConfigured ? <div className="form-error">Вход временно недоступен.</div> : null}

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field-span-2">
          <span>Пароль</span>
          <input
            autoComplete="current-password"
            disabled={busy || requiresPhpApi || !passwordConfigured}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <div className="form-error field-span-2">{error}</div> : null}

        <div className="field-span-2 form-actions">
          <button className="button" disabled={busy || requiresPhpApi || !passwordConfigured} type="submit">
            {busy ? 'Проверяем...' : 'Войти'}
          </button>
        </div>
      </form>
    </section>
  );
}
