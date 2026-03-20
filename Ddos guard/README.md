# DDoS-Guard Expo Arcade

Небольшое приложение для выставочного стенда: пользователь регистрируется, выбирает мини-игру, проходит одну сессию, а результат попадает в таблицу лидеров. Для оператора есть отдельная панель управления с результатами и профилями участников.

## Стек

- React + Vite
- Canvas mini-games
- PHP backend для хранения состояния, авторизации и Telegram Login

## Что умеет проект

- регистрация участника
- запуск одной игровой сессии
- таблица лидеров
- панель управления на `#/admin`
- общий доступ по коду доступа
- локальный demo-режим без backend

## Быстрый старт

Установить зависимости:

```bash
npm install
```

Запустить фронтенд без backend:

```bash
npm run dev
```

Адреса по умолчанию:

- пользовательский экран: `http://localhost:5173/#/`
- панель управления: `http://localhost:5173/#/admin`

## Полный запуск с backend

1. Создайте локальный конфиг:

```bash
cp backend/config.example.php backend/config.local.php
```

2. Запустите backend:

```bash
cd backend/api
php -S 0.0.0.0:8080
```

3. В другом терминале запустите фронтенд:

```bash
VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

## Запуск по локальной сети

Если проект нужно открыть с другого устройства в сети, используйте локальный IP машины вместо `localhost`.

Пример:

```bash
VITE_API_BASE_URL=http://<LAN_IP>:8080 npm run dev:lan
```

И не забудьте добавить этот origin в `backend/config.local.php`.

## Что важно не коммитить

- `backend/config.local.php`
- `backend/data/state.json`
- `node_modules/`
- `dist/`

## Документация

- инструкция по публикации на GitHub и совместной разработке: `docs/README.md`
- технические заметки: `docs/TECHNICAL.md`
