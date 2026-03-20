import { useState } from 'react';
import { digitsOnly, formatPhone } from '../lib/format';

const initialForm = {
  firstName: '',
  lastName: '',
  phone: '',
  telegram: '',
  source: 'manual',
  consent: false,
};

function TelegramLogo() {
  return (
    <svg aria-hidden="true" className="telegram-logo" viewBox="0 0 24 24">
      <path
        d="M21.9 4.6c.2-.9-.4-1.3-1.2-1L2.5 10.7c-.8.3-.8.8-.2 1l4.7 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .8-.2 1-.5l2.7-2.7 5.6 4.2c1 .6 1.7.3 2-.9l3-14.9Z"
        fill="currentColor"
      />
      <path d="m9.2 18.8.4-5.6 10.1-9.2-12.2 7.7-4.8-1.5 6.9 2.2-.4 6.4Z" fill="rgba(255,255,255,0.9)" />
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

  function handleTelegramChange(value) {
    if (value === '') {
      updateField('telegram', '');
    } else {
      updateField('telegram', '@' + value.replace(/^@+/, ''));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const digits = digitsOnly(form.phone);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Укажите имя и фамилию.');
      return;
    }

    const trimmedPhone = form.phone.trim();
    if (!trimmedPhone.startsWith('8') && !trimmedPhone.startsWith('+7')) {
      setError('Номер телефона должен начинаться с 8 или +7.');
      return;
    }

    if (digits.length !== 11) {
      setError('Укажите корректный российский номер телефона (11 цифр).');
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
      telegram: form.telegram,
      source: form.source,
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
          <span>Продолжить через Telegram</span>
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

        <label className="field-span-2">
          <span>Telegram</span>
          <input
            value={form.telegram}
            placeholder="@username"
            onChange={(event) => handleTelegramChange(event.target.value)}
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
