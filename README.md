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
разделами обращений, проектов, новостей, документов, реквизитов и пожертвований.
Обзор получает счетчики, предупреждения и последние административные действия
через один серверный read model; клиентские компоненты не запрашивают эти данные
отдельно. Для
проектов, новостей, документов и реквизитов используются статусы `DRAFT`,
`PUBLISHED` и `ARCHIVED`; на публичных страницах показывается только контент со
статусом `PUBLISHED`.

Очередь `/admin/messages` ищет по имени, email и тексту обращения, фильтрует по
статусу и московским календарным датам и показывает по 25 записей на страницу.
Детальная карточка поддерживает `NEW`, `IN_PROGRESS`, `CLOSED` и `SPAM`, а также
приватную внутреннюю заметку. Сохранение защищено optimistic concurrency по
`updatedAt`: если запись уже изменена, форма просит обновить страницу вместо
перезаписи чужих изменений. Число новых обращений загружается в защищенном
server layout и передается в меню только как агрегированное число — отдельного
клиентского API для бейджа нет.

Изменения статусов/заметок обращений и жизненного цикла проектов, новостей и
документов записываются атомарно в `AdminAuditEvent`. Журнал хранит только тип
действия, тип и идентификатор сущности, безопасные прежний/новый статусы и время.
Имена, email, тексты обращений, внутренние заметки, содержимое публикаций и
секреты в audit log не сохраняются. Публичная отправка контактной формы audit
событие не создает.

Метрики пожертвований «сегодня» и «текущий месяц» используют успешные платежи и
`paidAt` в полуоткрытых интервалах `[start, end)` часового пояса
`Europe/Moscow`. Предупреждения считаются для новых обращений строго старше
48 часов, ожидающих пожертвований строго старше часа и безопасных кодов
readiness. Ровно 48 часов и ровно один час просрочкой не считаются.

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

Миграция admin operations добавляет `SPAM`, `internalNote`,
`AdminAuditEvent`, `pg_trgm` и индексы очереди/поиска/метрик. Обычное создание
индексов на существующих `ContactRequest` и `Donation` блокирует запись, поэтому
production rollout выполняйте в согласованное окно обслуживания. Новый составной
индекс обращений создается до удаления старого. Перед deploy сделайте резервную
копию и проверьте наличие прав на `CREATE EXTENSION pg_trgm`. Если `pg_trgm` уже
установлен не в `public`, роль deploy также должна владеть расширением: миграция
переместит его в `public` до создания schema-qualified GIN-индексов и завершится
до application DDL, если прав недостаточно.

Интеграционную проверку этой миграции можно отдельно запустить на локальной
тестовой базе с установленным `psql`:

```bash
CONTENT_MIGRATION_TEST_DATABASE_URL="postgresql://localhost/foundation_test" \
  npm test -- src/db/content-migration.integration.test.ts
```

Защитная проверка принимает только `localhost` или `127.0.0.1` и имя базы с
суффиксом `_test`. Тест работает во временной изолированной схеме и удаляет ее
после завершения.

Миграцию и прикладные admin operations можно проверить одной безопасной
локальной базой:

```bash
ADMIN_OPERATIONS_TEST_DATABASE_URL="postgresql://localhost/foundation_test" \
  npm test -- src/db/admin-operations-migration.integration.test.ts
ADMIN_OPERATIONS_TEST_DATABASE_URL="postgresql://localhost/foundation_test" \
  npm test -- src/features/admin-operations.integration.test.ts
```

Прикладной suite применяет все миграции в случайной схеме и проверяет реальные
репозитории: поиск/пагинацию обращений, московские границы пожертвований,
строгие alert cutoff, atomic audit/rollback и отсутствие audit у публичной формы.
Без переменной suite пропускается; это означает «не проверено на PostgreSQL», а
не успешный DB-прогон.

### Операционный откат admin operations

Для предупреждений используются точные строгие условия: `NEW` считается
просроченным только при `createdAt < now - 48 hours`, а `PENDING` — только при
`createdAt < now - 1 hour`. Равенство порогу не включает запись в предупреждение.

При проблеме после deploy предпочтителен forward-fix. Если всё же нужен откат
приложения, заранее подготовленная совместимая сборка может не показывать новые
поля в UI, но обязана использовать перегенерированный Prisma Client и Prisma
schema со значением enum `SPAM`. Исходный артефакт до миграции небезопасен и
запрещён, как только `SPAM` мог быть записан: неизвестное значение Prisma enum
может привести к ошибке декодирования строки.

Если совместимой сборки нет, аварийный путь требует резервную копию и
согласованное окно обслуживания: остановите запись, явно подсчитайте количество
строк `SPAM`, затем выполните одобренную транзакцию `SPAM → IN_PROGRESS` и
проверьте нулевой остаток `SPAM`. Это lossy-операция с потерей классификации;
оператор обязан записать исходный count, обоснование и результат в журнал
изменений. По умолчанию используется `IN_PROGRESS`, чтобы не закрывать обращения
молча. Аварийный remap должен успешно завершиться и провериться до запуска
старого артефакта.

Автоматический destructive down/откат схемы не предоставляется: добавленная
аддитивная схема остаётся на месте. Последующая очистка допустима только после
свежей резервной копии и доказательства, что число `SPAM` равно нулю, а
`internalNote` и audit больше не используются и от них ничего не зависит. Такая
очистка выполняется отдельной проверенной миграцией в новое окно обслуживания,
а не разовым ad-hoc SQL.

Query-параметр поиска может содержать email и остается в истории браузера. В
production access-логи reverse proxy и хостинга должны удалять или не записывать
query string для маршрутов `/admin`.

Production-ответы `/admin` получают `Cache-Control: private, no-store,
max-age=0`. В режиме `next dev` Next.js может заменить его на `no-cache,
must-revalidate`; проверять итоговый заголовок нужно через `next build` и
`next start`.

## Проверки

Перед запуском создайте `.env` и задайте обе переменные подключения:
`DATABASE_URL` и `DATABASE_URL_UNPOOLED`.

```bash
npm run verify
```

Команда запускает модульные тесты, линтер, проверку типов и схемы Prisma и сборку.
Проверка типов сначала генерирует игнорируемые декларации Next.js.
Это local working-tree pre-commit gate: staged и unstaged слои проверяются отдельно
на пробельные ошибки. Команда не является clean-checkout CI range gate.
DB-backed интеграционные проверки остаются отдельными командами, потому что им
нужна безопасная локальная тестовая база:

- платежи — `npm run test:integration:payments`;
- миграция контента — `npm test -- src/db/content-migration.integration.test.ts`.

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
- `GET /api/health` — platform liveness (ответ `{ "ok": true }`, без авторизации);
- Post-deploy configuration readiness: `GET /api/ready` проверяет конфигурацию
  административного доступа и отвечает `503`, если она некорректна;
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
