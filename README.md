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
версия оферты: `2026-09-04`. Production требует HTTPS и `PAYMENTS_TRUST_PROXY=true`
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

## Timeweb

Боевой сайт работает в Timeweb Cloud App Platform в Москве (`fond-bit-dobru.ru`).
Политика персональных данных не допускает иностранный хостинг, поэтому Vercel
и Neon не являются production.

В панели приложения:

- framework: Next.js (не Nest);
- Build: `npm run timeweb-build` — `prisma generate`, `prisma migrate deploy`,
  затем `next build`. `DATABASE_URL` должен быть доступен на сборке;
- Run: `npm run timeweb-start` — только `next start` на `0.0.0.0` и `$PORT`.
  Миграции не должны выполняться при каждом рестарте процесса;
- Health check: `GET /api/health` (ответ `{ "ok": true }`, без авторизации);
- `NEXT_PUBLIC_SITE_URL=https://fond-bit-dobru.ru` задаётся **до сборки**:
  Next.js вшивает `NEXT_PUBLIC_*` на build. `SITE_URL` — тот же origin на
  рантайме.

`next/image` на этом хосте идёт без серверного оптимизатора: рантайм не может
писать в `/app/.next/cache/images`.

Загрузки в production идут в объектное хранилище Timeweb S3, не в `public/` и
не в Vercel Blob. Локальный диск контейнера недолговечен и часто только для
чтения.

PostgreSQL — кластер Timeweb в той же зоне. Включите автобэкапы в панели базы.

| Переменная | Production (Timeweb) |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://fond-bit-dobru.ru` без пути, query и фрагмента |
| `SITE_URL` | тот же origin, что и `NEXT_PUBLIC_SITE_URL` |
| `DATABASE_URL` | URL кластера Timeweb Postgres |
| `DATABASE_URL_UNPOOLED` | тот же URL, если пулер не используется |
| `AUTH_SECRET` | случайная строка не короче 32 символов |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | рабочие логин и пароль админки |
| `ADMIN_TRUST_PROXY` | `true` |
| `PAYMENTS_ENABLED` | `false`, пока оферта не утверждена |
| `PAYMENTS_OFFER_VERSION` | пусто, пока оферта не утверждена |
| `PAYMENTS_RATE_LIMIT_SECRET` | случайная строка не короче 32 символов |
| `PAYMENTS_TRUST_PROXY` | `true` |
| `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` | пусто, пока платежи выключены |
| `YOOKASSA_RETURN_URL` | `https://fond-bit-dobru.ru/donation/result` |
| `S3_ENDPOINT` | endpoint бакета Timeweb S3 |
| `S3_REGION` | регион бакета |
| `S3_BUCKET` | имя публичного бакета |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | ключи бакета |
| `S3_PUBLIC_BASE_URL` | публичный origin объектов, без завершающего `/` |

Webhook ЮKassa, когда платежи включат:

```text
https://fond-bit-dobru.ru/api/payments/webhook
```

Секреты в git не коммитятся.

## Vercel

Vercel — только превью без боевого домена и без персональных данных.
Сборка выполняет `prisma generate`, затем `prisma migrate deploy`, затем
`next build` (`npm run vercel-build`). Не направляйте `fond-bit-dobru.ru` на
Vercel и не подключайте preview к боевой базе Timeweb.

Если превью всё же поднимают, задайте `ADMIN_TRUST_PROXY=true`,
`PAYMENTS_TRUST_PROXY=true` и `PAYMENTS_ENABLED=false`. `DATABASE_URL` для
такого превью — отдельная база, не кластер production. `DATABASE_URL_UNPOOLED`
нужен `prisma migrate deploy` на этой отдельной базе.

Локальная копия переменных панели может лежать в gitignored-файле
`.env.vercel.local`.

## Ограничения контента

Новости, отчеты, банковские реквизиты и юридические тексты не публикуются до
проверки. Публичные страницы читают только записи со статусом `PUBLISHED`.
Приложение хранит ссылки на изображения и документы, но не загружает файлы и не
обещает конкретный формат документов.
