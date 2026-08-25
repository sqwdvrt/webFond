# Фонд «Быть Добру»

Публичный сайт благотворительного фонда. Проект использует Next.js App Router,
TypeScript, Tailwind CSS, PostgreSQL и Prisma.

Правила и этапы находятся в [`PROJECT_PLAN.md`](./PROJECT_PLAN.md), краткий журнал
работы — в [`WORK_REPORT.md`](./WORK_REPORT.md).

## Требования

- Node.js 20.9 или новее;
- npm;
- PostgreSQL для работы с данными.

## Локальный запуск

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npm run db:generate
npm run dev
```

После запуска сайт доступен по адресу [http://localhost:3000](http://localhost:3000).

Перед первым запуском укажите рабочий `DATABASE_URL`. Команда
`prisma migrate deploy` применит начальную миграцию из `prisma/migrations`.

## Административная часть

Форма входа доступна по адресу
[http://localhost:3000/admin/login](http://localhost:3000/admin/login). Для нее
нужны серверные переменные:

```dotenv
ADMIN_USERNAME=""
ADMIN_PASSWORD=""
AUTH_SECRET=""
ADMIN_TRUST_PROXY="false"
```

Заполните логин и пароль вручную, а случайный секрет длиной не менее 32 символов
можно получить командой `openssl rand -hex 32`. Пустые значения из
`.env.example` намеренно не проходят проверку конфигурации.

`ADMIN_TRUST_PROXY=true` допустим только за reverse proxy, который перезаписывает
клиентские forwarding-заголовки. Рабочие значения хранятся в `.env` и не
добавляются в git.

После входа `/admin` открывает единую административную часть с обзором и
разделами проектов, новостей, документов, реквизитов и пожертвований. Для
проектов, новостей, документов и реквизитов используются статусы `DRAFT`,
`PUBLISHED` и `ARCHIVED`; на публичных страницах показывается только контент со
статусом `PUBLISHED`.

Изображения проектов и новостей, а также документы задаются URL. Загрузка файлов
в приложении не реализована, и формат документа, включая PDF, не гарантируется.

В `/admin/donations` фильтры по статусу, дате создания и строке поиска
выполняются на сервере. CSV содержит только текущую отфильтрованную выборку и не
зависит от номера страницы. Календарные границы и отображение дат используют
`Europe/Moscow`.

Перед запуском новой версии примените миграции:

```bash
npx prisma migrate deploy
```

Команда применяет миграции к базе из `DATABASE_URL`, поэтому перед запуском
проверьте адрес и имя целевой базы. Миграция публикации сохраняет существующие
записи, заполняет статусы документов и даты уже опубликованных проектов и
новостей.

Интеграционную проверку этой миграции можно отдельно запустить на локальной
тестовой базе с установленным `psql`:

```bash
CONTENT_MIGRATION_TEST_DATABASE_URL="postgresql://localhost/foundation_test" \
  npm test -- src/db/content-migration.integration.test.ts
```

Защитная проверка принимает только `localhost` или `127.0.0.1` и имя базы с
суффиксом `_test`. Тест работает во временной изолированной схеме и удаляет ее
после завершения.

Query-параметр поиска может содержать email и остается в истории браузера. В
production access-логи reverse proxy и хостинга должны удалять или не записывать
query string для маршрутов `/admin`.

Production-ответы `/admin` получают `Cache-Control: private, no-store,
max-age=0`. В режиме `next dev` Next.js может заменить его на `no-cache,
must-revalidate`; проверять итоговый заголовок нужно через `next build` и
`next start`.

## Проверки

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run db:validate
```

## Платежи

Контур разового пожертвования через СБП реализован, но по умолчанию выключен.
`PAYMENTS_ENABLED=false`, пока нет утверждённой оферты и тестовых ключей ЮKassa.
Секрет ЮKassa используется только на сервере и не должен иметь префикс
`NEXT_PUBLIC_`.

Нужные серверные переменные:

```dotenv
PAYMENTS_ENABLED=false
PAYMENTS_OFFER_VERSION=
PAYMENTS_RATE_LIMIT_SECRET=
PAYMENTS_TRUST_PROXY=false
YOOKASSA_SHOP_ID=""
YOOKASSA_SECRET_KEY=""
YOOKASSA_RETURN_URL="http://localhost:3000/donation/result"
```

`PAYMENTS_ENABLED=true` включает `/help` и `POST /api/payments/create` только если
оферта опубликована и `PAYMENTS_OFFER_VERSION` совпадает с её версией. Текущая
версия оферты: `2026-08-23`. Production требует HTTPS и `PAYMENTS_TRUST_PROXY=true`
за reverse proxy, который сам формирует forwarding-заголовки.

Маршруты:

- `POST /api/payments/create` — создание разового платежа СБП;
- `POST /api/payments/webhook` — уведомления ЮKassa `payment.succeeded` и
  `payment.canceled`;
- `/donation/result` — проверка результата, страница не индексируется.

Webhook не доверяет телу уведомления: сервер запрашивает платёж в ЮKassa и только
после этого меняет статус. Подписок и автосписаний нет.

После изменения схемы:

```bash
npx prisma migrate deploy
```

Проверки платежного контура:

```bash
npm test
PAYMENTS_TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/foundation_payments_test" \
  npm run test:integration:payments
```

Интеграционная команда обязательна: без безопасного URL тестовой базы она
завершается ошибкой, а не skip. Имя базы должно оканчиваться на `_test`.

До тестового магазина ЮKassa внешний QR, возврат на сайт и доставка webhook
проверяются детерминированными тестами с подменённым HTTP. Живой тестовый платёж
остаётся в этапе 5.

## Vercel

Сайт рассчитан на Next.js на Vercel и PostgreSQL в Neon. Сборка на Vercel
выполняет `prisma generate`, затем `prisma migrate deploy`, затем `next build`.
Локальная команда `npm run build` миграции не применяет.

1. Импортируйте репозиторий в [Vercel](https://vercel.com/new) (Framework Preset:
   Next.js). Файл `vercel.json` уже задаёт команду сборки.
2. База Postgres уже подготовлена в Neon: проект `byt-dobru-foundation`.
   В Vercel Environment Variables добавьте значения из `.env.vercel.local`.
   Production — ветка Neon `main`, Preview — ветка `preview`, чтобы миграции
   превью не меняли боевую схему.
3. После первого деплоя подставьте фактический HTTPS-домен в `NEXT_PUBLIC_SITE_URL`,
   `SITE_URL` и `YOOKASSA_RETURN_URL` и задеплойте ещё раз.
4. Платежи в первом выпуске выключены: `PAYMENTS_ENABLED=false`.
   На Vercel задайте `ADMIN_TRUST_PROXY=true` и `PAYMENTS_TRUST_PROXY=true`:
   платформа сама подставляет forwarding-заголовки.

| Переменная | Production |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://<домен>` без пути, query и фрагмента |
| `SITE_URL` | тот же origin, что и `NEXT_PUBLIC_SITE_URL` |
| `DATABASE_URL` | Neon pooled URL (`-pooler`) с `sslmode=require`, `pgbouncer=true` и `connect_timeout=15` |
| `DATABASE_URL_UNPOOLED` | Neon direct URL без `-pooler`, для `prisma migrate deploy` |
| `AUTH_SECRET` | случайная строка не короче 32 символов |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | рабочие логин и пароль админки |
| `ADMIN_TRUST_PROXY` | `true` |
| `PAYMENTS_ENABLED` | `false` |
| `PAYMENTS_OFFER_VERSION` | пусто, пока оферта не утверждена |
| `PAYMENTS_RATE_LIMIT_SECRET` | случайная строка не короче 32 символов |
| `PAYMENTS_TRUST_PROXY` | `true` |
| `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` | пусто, пока платежи выключены |
| `YOOKASSA_RETURN_URL` | `https://<домен>/donation/result` |

Webhook ЮKassa, когда платежи включат:

```text
https://<домен>/api/payments/webhook
```

Секреты и строки подключения в git не коммитятся. Локальная копия для панели
Vercel может лежать в gitignored-файле `.env.vercel.local`.

## Ограничения контента

Новости, отчеты, банковские реквизиты и юридические тексты не публикуются до
проверки. Публичные страницы читают только записи со статусом `PUBLISHED`.
Приложение хранит ссылки на изображения и документы, но не загружает файлы и не
обещает конкретный формат документов.
