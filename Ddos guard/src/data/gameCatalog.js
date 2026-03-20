export const GAME_CATALOG = [
  {
    id: 'shield-hop',
    title: 'Shield Hop',
    subtitle: 'Doodle Jump x Edge Firewall',
    teaser: 'Сеть под атакой. Периметр трещит.\nПрыгай выше, держись дольше и не дай врагу прорваться внутрь.\nКаждая секунда — это борьба за выживание системы.',
    durationSeconds: 75,
    controls: 'A / D или стрелки влево-вправо',
    goal: 'Удержаться на высоте до конца волны.',
    accent: 'brand-ink',
  },
  {
    id: 'edge-glide',
    title: 'Edge Glide',
    subtitle: 'Flappy Bird x Traffic Tunnels',
    teaser: 'Трафик нестабилен. Каналы перегружены.\nПройди сквозь цифровой шторм и сохрани поток данных чистым.\nОдна ошибка — и сеть падает.',
    durationSeconds: 70,
    controls: 'Пробел, клик или тап',
    goal: 'Прожить до конца раунда и набрать максимум проходов.',
    accent: 'brand',
  },
  {
    id: 'bot-slicer',
    title: 'Bot Slicer',
    subtitle: 'Fruit Ninja x Anti-Bot',
    teaser: 'Они приходят волнами.\nБоты, маскирующиеся под пользователей.\nРежь точно. Быстро. Без ошибок.',
    durationSeconds: 60,
    controls: 'Мышь или палец по экрану',
    goal: 'Срезать максимум ботов и не потерять устойчивость.',
    accent: 'brand-soft',
  },
  {
    id: 'infra-stack',
    title: 'Infra Stack',
    subtitle: 'Tower Builder x Network Layers',
    teaser: 'Ты строишь систему.\nНо выдержит ли она нагрузку?\nОдин неверный слой — и всё рухнет.',
    durationSeconds: 75,
    controls: 'Пробел, клик или тап',
    goal: 'Выстроить устойчивую башню из 10 слоев.',
    accent: 'brand',
  },
  {
    id: 'packet-catcher',
    title: 'Packet Catcher',
    subtitle: 'Catcher x Traffic Filtering',
    teaser: 'Поток данных не остановить.\nНо ты можешь его контролировать.\nОтдели норму от угрозы — и спаси систему',
    durationSeconds: 70,
    controls: 'A / D, стрелки или мышь',
    goal: 'Сохранить фильтр живым до конца волны.',
    accent: 'brand-soft',
  },
];

export function getGameById(id) {
  return GAME_CATALOG.find((game) => game.id === id) ?? GAME_CATALOG[0];
}
