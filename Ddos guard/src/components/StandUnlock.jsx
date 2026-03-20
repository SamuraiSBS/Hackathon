export function StandUnlock({ error, tokenConfigured }) {
  return (
    <section className="panel panel--feature">
      <div className="eyebrow">Доступ</div>
      <h1>Доступ временно закрыт</h1>
      <p className="panel-copy">Обратитесь к администратору.</p>

      {!tokenConfigured ? <div className="form-error">Доступ временно недоступен.</div> : null}

      {error ? <div className="form-error">{error}</div> : null}
    </section>
  );
}
