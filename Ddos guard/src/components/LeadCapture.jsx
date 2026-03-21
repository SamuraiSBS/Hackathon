import { useState } from 'react';
import { digitsOnly, formatPhone } from '../lib/format';

const initialForm = {
  firstName: '',
  lastName: '',
  phone: '',
  consent: false,
};

function TelegramLogo() {
  return (
    <svg aria-hidden="true" className="telegram-logo" viewBox="0 0 64 64">
      <path
        d="M55.7 9.4 8.9 27.5c-3.2 1.3-3.1 3.1-.6 3.9l12 3.7 4.5 14.1c.6 1.9 1.2 2.6 2.4 2.6 1 0 1.6-.5 2.5-1.4l6.9-6.7 14.4 10.5c2.6 1.4 4.5.7 5.2-2.4l8.1-39.1c1-4-1.5-5.8-4.2-4.7Z"
        fill="#dbe8f3"
      />
      <path
        d="m24.1 49.3 2.1-15.8 28.8-19.5-34.3 15.4-12-3.7 46.8-18.2c2.2-.8 4.3.5 3.5 4.5l-7.9 39c-.5 2.3-1.8 2.9-4 1.7L33.6 42.4l-7 7c-.8.8-1.4 1.1-2.5-.1Z"
        fill="#b4cce0"
      />
      <path
        d="m27.7 35.4 24.6-17.1-18.8 20.2-.7 9.4 3.3-6.8 14.1 10.3c1.9 1.3 3.2.6 3.7-1.7l8-39c.8-3.8-1.2-5.2-3.5-4.4L8.8 25c-2.4.9-2.3 2.6-.4 3.3l12.2 3.8 28.1-18-21 22.4Z"
        fill="#f7fbff"
      />
    </svg>
  );
}

export function LeadCapture({ onSubmit, busy, telegramAuth, onTelegramLogin }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const telegramConfigured = Boolean(telegramAuth?.configured);
  const telegramBusy =
    telegramAuth?.status === 'checking' ||
    telegramAuth?.status === 'redirecting' ||
    telegramAuth?.status === 'submitting';

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const digits = digitsOnly(form.phone);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Укажите имя и фамилию.');
      return;
    }

    if (digits.length < 10) {
      setError('Укажите корректный номер телефона.');
      return;
    }

    if (!form.consent) {
      setError('Подтвердите согласие на обработку данных.');
      return;
    }

    setError('');
    await onSubmit({
      firstName: form.firstName,
      lastName: form.lastName,
      phone: formatPhone(form.phone),
      source: 'manual',
    });
  }

  return (
    <section className="panel panel--feature">
      <div className="eyebrow">Регистрация</div>
      <h1>Профиль участника</h1>
      <p className="panel-copy">Заполните форму или продолжите через Telegram.</p>

      <div className="telegram-login-row">
        <button
          className="telegram-login-button"
          disabled={!telegramConfigured || busy || telegramBusy}
          type="button"
          onClick={onTelegramLogin}
        >
          <TelegramLogo />
          <span>Зарегистрироваться через Telegram</span>
        </button>
        {!telegramConfigured ? <div className="telegram-login-hint">Telegram временно недоступен.</div> : null}
        {telegramAuth?.error ? <div className="form-error">{telegramAuth.error}</div> : null}
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          <span>Имя</span>
          <input value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} />
        </label>

        <label>
          <span>Фамилия</span>
          <input value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} />
        </label>

        <label className="field-span-2">
          <span>Телефон</span>
          <input
            value={form.phone}
            placeholder="+7 (999) 000-00-00"
            onChange={(event) => updateField('phone', event.target.value)}
          />
        </label>

        <label className="checkbox field-span-2">
          <input
            checked={form.consent}
            type="checkbox"
            onChange={(event) => updateField('consent', event.target.checked)}
          />
          <span>Согласен на обработку персональных данных.</span>
        </label>

        {error ? <div className="form-error field-span-2">{error}</div> : null}

        <div className="field-span-2 form-actions">
          <button className="button" disabled={busy || telegramBusy} type="submit">
            {busy ? 'Сохраняем...' : 'Продолжить'}
          </button>
        </div>
      </form>
    </section>
  );
}
