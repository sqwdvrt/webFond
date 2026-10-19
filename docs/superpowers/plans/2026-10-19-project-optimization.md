# Оптимизация webFond — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Выполнять последовательно; не начинать реализацию по одному лишь факту создания этого документа.

**Goal:** Сократить подтверждённую лишнюю работу приложения, исправить CI и обслуживание технических данных, уменьшить изображения без нарушения платежных и редакционных гарантий.

**Architecture:** Сохранить Next.js App Router, Prisma/PostgreSQL и Timeweb S3. Добавить узкие ограниченные read-запросы, пакетное разрешение audit-ссылок, независимый maintenance endpoint и преобразование новых изображений в памяти. Межзапросный кеш вводить только отдельным релизом при выполнении измеримого условия из design.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 6, PostgreSQL 16, Vitest, GitHub Actions; Sharp как прямая production-зависимость на этапе изображений.

**Design:** `docs/superpowers/specs/2026-10-19-project-optimization-design.md`.

**Корень проекта:** `/Users/sqwdvrt/VS Code/projects/webFond`. Пути ниже относительно этого корня; команды выполняются в нём либо в согласованном checkout с тем же состоянием.

---

## 0. Порядок, ограничения и результат

Первый релиз: задачи 1–9. Их можно выпускать частями: CI/зависимости → запросы → обслуживание → изображения. Задача 10 — отдельное решение по кешу после измерений. Она может закончиться документированным выводом «не требуется».

Не переносить в оптимизацию переписывание UI, новый механизм авторизации, изменение платежного flow, удаление Vercel-совместимости, новые индексы без EXPLAIN или массовую миграцию Next.js Cache Components.

Не менять текущие тексты/FAQ для прохождения устаревших проверок: сначала установить, какие изменения публичного сайта уже приняты. Не удалять существующие тесты и не переводить их в skip ради зелёного CI.

Повторная исходная проверка при написании плана: `npm test` — 1458 passed, 12 skipped; `npm run typecheck` — exit 0. Предыдущие падения устранены параллельными изменениями. Эти числа не заменяют новый прогон перед реализацией.

## 1. Зафиксировать базовую линию и среду

**Файлы:** создать `docs/performance/2026-10-19-baseline.md`; при измерениях добавить `scripts/measure-public-performance.mjs`. Существующие исходники на этом шаге не менять.

- [ ] Снять `git status --short`, текущий HEAD и список незакоммиченных файлов. Дождаться окончания параллельных правок публичного сайта либо работать с явно зафиксированным согласованным снимком. Не делать reset/stash чужих файлов и не коммитить их автоматически.
- [ ] Зафиксировать `node --version`, `npm --version`, `npm ls next react prisma @prisma/client --depth=0` и реальные ограничения runtime Timeweb. Версия из package.json с `^` не равна гарантированно установленной.
- [ ] Выполнить отдельно `npm test`, `npm run lint`, `npm run typecheck`, `npm run db:validate`, `npm run build`, `npm audit --audit-level=high`, `npm audit --omit=dev --audit-level=high`. Сохранить exit code и краткий результат каждого; не останавливать весь аудит на первом сбое.
- [ ] Для Prisma CLI явно предоставить тестовые DATABASE_URL и DATABASE_URL_UNPOOLED. `.env.local` автоматически читает Next.js, но не обязательно Prisma CLI. Не печатать реальные URL и секреты в отчёт.
- [ ] Поднять отдельную локальную PostgreSQL с именем БД `foundation_optimization_test`; применить туда миграции. Все тестовые URL задавать явно на localhost. Рабочая/production БД не используется для seeds или нагрузочных тестов.
- [ ] На тестовой БД подготовить неперсональные фикстуры: 1000 проектов, 1000 документов, 1000 новостей, 100000 пожертвований, 10 audit-событий с повторяющимися и отсутствующими entityId. Использовать префикс и удаление только собственных фикстур. Фикстуры не публиковать на боевом сайте.
- [ ] Измерить production-сборку: `/`, `/news`, `/projects`, `/reports`, `/sitemap.xml`; `/admin` отдельно с тестовой сессией. 10 запросов прогрева, затем не менее 100 запросов для concurrency 1 и 5, минимум три повтора. Записать p50/p95 TTFB, error rate, RSS, размеры ответа и SQL-показатели; отдельно cold start. Время сборки не считать скоростью сайта.
- [ ] SQL-показатели собирать в отдельном тестовом harness через Prisma query events без параметров/персональных данных. Не включать глобальное логирование SQL в production. Метрики HTTP не подменяют число запросов к БД.

**Готово:** есть воспроизводимый baseline, известны пропущенные DB-suite и состояние workspace. Измерительный скрипт принимает только тестовый origin/разрешённые маршруты, ограничивает конкурентность и не инициирует POST/payment/contact действия.

## 2. Исправить платежный CI и добавить общий release gate

**Изменить:** `.github/workflows/payments-integration.yml`, `src/features/payments/ci-workflow.test.ts`, `README.md`.
**Создать:** `.github/workflows/quality.yml`.

- [ ] Расширить тест workflow: для job без container URL использует localhost; DATABASE_URL, DATABASE_URL_UNPOOLED и PAYMENTS_TEST_DATABASE_URL указывают на одну тестовую БД. Проверка должна отклонять старый host `postgres`, а не просто искать слово postgres в YAML.
- [ ] Запустить `npm test -- src/features/payments/ci-workflow.test.ts`, подтвердить падение именно на старой конфигурации.
- [ ] В существующем платежном workflow заменить два URL на `postgresql://postgres:postgres@localhost:5432/foundation_payments_test`, добавить такой же DATABASE_URL_UNPOOLED. Сохранить readiness healthcheck контейнера, `5432:5432`, `npm ci`, миграции и отдельную платежную команду. Не ослаблять защиту тестовых URL.
- [ ] Новый `quality` job: pull_request и push в используемую основную ветку/develop; выбрать Node 22 LTS, удовлетворяющий engines, зафиксировать ту же версию в обоих workflow. `permissions: contents: read`, npm cache, timeout, отмена устаревшего запуска только для того же ref.
- [ ] В quality job с PostgreSQL16 глобально задать только DATABASE_URL и DATABASE_URL_UNPOOLED на `postgresql://postgres:postgres@localhost:5432/foundation_quality_test`. Установить клиент `psql`, проверить `psql --version`, выполнить миграции до DB-тестов. Опциональные переменные DB-suite не задавать глобально.
- [ ] Выполнить `npm run verify` без переменных опциональных DB-suite, затем production-only audit. Далее выполнить четыре отдельных шага из списка ниже строго последовательно; каждой команде передавать только её тестовую переменную с тем же URL `foundation_quality_test`. Они не должны пересекаться ни между процессами, ни внутри одного запуска Vitest: migration-suite перемещает общий для всей БД pg_trgm, поэтому разных схем недостаточно. Skip внутри общего unit-прогона допустим только при наличии успешного отдельного прогона каждого DB-suite.

  1. `CONTENT_MIGRATION_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/foundation_quality_test npm test -- src/db/content-migration.integration.test.ts`
  2. `ADMIN_OPERATIONS_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/foundation_quality_test npm test -- src/db/admin-operations-migration.integration.test.ts`
  3. `CONTENT_REPOSITORY_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/foundation_quality_test npm test -- src/features/content-admin/repository.integration.test.ts`
  4. `ADMIN_OPERATIONS_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/foundation_quality_test npm test -- src/features/admin-operations.integration.test.ts`

  Платежный job использует собственный service container и отдельную БД foundation_payments_test. После задачи 6 добавить пятый последовательный шаг с ADMIN_OPERATIONS_TEST_DATABASE_URL и единственным файлом `src/features/maintenance/rate-limit-cleanup.integration.test.ts`. Не объединять четыре/пять файлов в один параллельный Vitest-запуск.
- [ ] Если для build нужны config-переменные, задать только тестовые значения, `PAYMENTS_ENABLED=false`, тестовый site origin и безопасные admin-настройки; внешние production секреты не подключать.
- [ ] Перезапустить тест workflow и оба job. Локальная текстовая проверка YAML не является доказательством успеха GitHub Actions. Настройку required checks в защите ветки записать как отдельное действие владельца репозитория, если она недоступна исполнителю.

**Готово:** реальные CI-job зелёные; Prisma не падает из-за directUrl; PostgreSQL доступна; unit, types, lint, build и DB-интеграции обязательны.
**Коммит:** `fix(ci): run complete checks against local postgres service`.

## 3. Разобрать предупреждения dev-зависимостей

**Изменить при наличии совместимого исправления:** `package.json`, `package-lock.json`.
**Создать:** `docs/security/dependency-audit.md`.

- [ ] Повторить `npm audit --json` и `npm explain braces`; установить точную цепочку ESLint → fast-glob → micromatch → braces и наличие исправленных версий на день работы. Пять high в отчёте могут относиться к одной корневой проблеме.
- [ ] Предпочесть совместимое официальное обновление eslint-config-next/Next и lockfile. Не выполнять `npm audit fix --force` и не менять major вслепую.
- [ ] Scoped override допустим только при опубликованной исправленной совместимой версии и успешной проверке её потребителя; глобальная подмена неизвестного API запрещена.
- [ ] Если upstream-исправления нет, явно зафиксировать unresolved advisory, dev-only область, обработку только доверенных glob-шаблонов, владельца и дату пересмотра 2 ноября 2026 года. Не объявлять проблему исправленной и не отключать весь audit в CI.
- [ ] На изменённом lockfile выполнить `npm ci`, `npm test`, lint, typecheck, build, оба audit. Обновление зависимостей проверять отдельно от оптимизации запросов.

**Готово:** production high/critical = 0; dev high либо устранены, либо имеют точечное временное исключение с объяснением и сроком. При отсутствии исправления первый релиз оптимизаций может продолжаться с документированным остаточным риском.
**Коммит:** `chore(deps): address audited tooling dependency risk`.

## 4. Ограничить данные главной непосредственно в PostgreSQL

**Изменить:** `src/features/homepage/evidence.ts`, `src/features/homepage/evidence.test.ts`, `src/features/fundraising/public-projects.ts`, `src/features/fundraising/public-projects.test.ts`, `src/features/content-admin/repository.ts`, `src/features/content-admin/repository.test.ts`.

- [ ] Добавить отдельные функции `listHomeProjectsForDisplay(client = prisma)` и `listHomeDocuments(client = prisma)` с фиксированным лимитом 3. Существующие `listPublishedProjectsForDisplay(client)` и `listPublishedDocuments(client)` сохраняют параметры и семантику для других страниц.
- [ ] До реализации проверить тестами `where: {status: 'PUBLISHED'}`, `take: 3`, прежний стабильный порядок `publishedAt DESC, id DESC` и безопасный select без полного content.
- [ ] Для проектов написать сценарий: в БД >3 проектов; groupBy получает только ID отобранных трёх, причём только с положительной целью. При отсутствии таких целей groupBy не вызывается. Расчёты SUCCEEDED/копейки/ручная сумма остаются прежними.
- [ ] Запустить целевые тесты и зафиксировать ожидаемое падение. Вынести минимальный общий внутренний query-builder, если нужно избежать дублирования select/order; не вводить универсальный repository framework.
- [ ] Переключить зависимости `loadHomeEvidence` на ограниченные функции. Сохранить Promise.allSettled и разницу `[]`/`null`; defensive slice допустим, но не считается заменой SQL LIMIT.
- [ ] Проверить целевые тесты, `src/app/page.test.tsx`, `src/components/content/home-evidence.test.tsx`, `src/features/fundraising/totals.test.ts` и typecheck.
- [ ] На локальной БД сверить реальные LIMIT/число строк и `EXPLAIN (ANALYZE, BUFFERS)` без production-данных. Ожидается максимум 3 строки каждой основной выборки и один groupBy для отобранных проектов; новые индексы не добавлять без доказательства.

**Готово:** размер выдачи главной не растёт с размером коллекций; полные разделы и суммы не изменились.
**Коммит:** `perf(home): limit evidence queries before fundraising aggregation`.

## 5. Устранить дополнительные запросы по каждой audit-записи

**Изменить:** `src/features/admin-dashboard/read-model.ts`, `src/features/admin-dashboard/read-model.test.ts`, `src/features/admin-operations.integration.test.ts`.

- [ ] Написать тест с десятью событиями одного типа, повторными ID, отсутствующей сущностью и событием REQUISITES. Проверить один findMany на тип, дедупликацию ID, порядок/количество событий и `href: null` для удалённой сущности.
- [ ] Проверить смешанные PROJECT, NEWS_POST, DOCUMENT, CONTACT_REQUEST, DONATION и REQUISITES; не запрашивать делегаты отсутствующих типов. Существующие mock-делегаты дополнить findMany там, где потребуется.
- [ ] Внутри существующей RepeatableRead-транзакции собрать `Map<entityType, Set<id>>`; выполнить `findMany({where:{id:{in:[...] }},select:{id:true}})` для каждого присутствующего типа. Наличие requisites проверить один раз с select key.
- [ ] Построить события из исходного массива и таблиц существования. DONATION сохраняет `/admin/donations?donationId=...`, другие типы — текущие адреса. Ничего из contact/email/note/content не выбирать.
- [ ] Не убирать транзакцию ради обещания параллельности Promise.all: согласованный snapshot важнее. Не объединять все счётчики и агрегаты в большой raw SQL без отдельного профилирования.
- [ ] Прогнать unit и локальную admin-operations интеграцию. Проверить 0–6 запросов разрешения ссылок вместо 0–10 и отсутствие дубликатов запросов для одной сущности; это предел только блока ссылок, а не всего dashboard.

**Готово:** число запросов блока зависит от числа типов сущностей, а не числа событий; атомарность и прежние href сохранены.
**Коммит:** `perf(admin): resolve audit entity links in batches`.

## 6. Независимая ограниченная очистка rate-limit buckets

**Создать:** `src/features/maintenance/rate-limit-cleanup.ts`, `.test.ts`, `.integration.test.ts`; `src/app/api/maintenance/rate-limits/cleanup/route.ts`, `route.test.ts`.
**Изменить:** `.env.example`, `README.md`, `src/features/payments/repository.ts`, `src/features/payments/repository.test.ts`.

**HTTP-контракт:** POST `/api/maintenance/rate-limits/cleanup`, секрет `MAINTENANCE_SECRET` минимум 32 символа в `x-maintenance-secret`. Отдельный от платежной конфигурации секрет. Без query-параметров и пользовательского времени. Ответ 200: `{deleted: number, batchFull: boolean}`; неверный секрет 401, отсутствующая/некорректная серверная настройка 503, ошибка БД 503. Заголовки no-store/no-referrer/nosniff. Ни ключи buckets, ни секрет не выводятся.

- [ ] Написать unit-тесты: пустая таблица, удаление только `expiresAt <= cutoff`, сохранение активных записей, повторный запуск, batchFull, ошибка БД. Route: auth до DB-вызова, PAYMENTS_ENABLED=false, неверный/пустой секрет, безопасные ответы.
- [ ] Реализовать один SQL-пакет максимум 1000 строк: выбрать `(key, windowStart)` по expiresAt/key/windowStart с `FOR UPDATE SKIP LOCKED`, удалить по полному составному ключу и вернуть только число строк. Весь пакет — один атомарный SQL statement. cutoff формирует сервер один раз на запуск.
- [ ] Ограничить ожидание SQL серверным statement_timeout в локальной транзакции до 2 секунд; передать Prisma transaction timeout с запасом, чтобы возврат ошибки успел завершиться. Не запускать бесконечный цикл очистки и не блокировать таблицу целиком.
- [ ] DB-интеграция: >1000 просроченных записей и активные записи, два одновременных запуска, отсутствие пересечений удалённых строк/ошибок, постепенное опустошение очереди. Использовать безопасный ADMIN_OPERATIONS_TEST_DATABASE_URL и изолированную схему; включить файл в quality job явно и проверить, что он не skipped.
- [ ] Настроить scheduler тестового контура раз в минуту и проверить выполнение с выключенными платежами. Записывать только время, число удалённых строк, длительность и безопасный код ошибки. `batchFull` означает заполненный пакет, не точную гарантию наличия следующей строки.
- [ ] Для production описать настройку scheduler и секрета без публикации значения; подтвердить хотя бы два успешных запуска и убывание backlog. Если scheduler недоступен, старую opportunistic cleanup пока оставить и не объявлять этап завершённым.
- [ ] Только после проверки scheduler удалить awaited `deleteMany` из createOrReusePending в платежном repository; обновить тесты так, чтобы они проверяли удаление из горячего пути, а не отменяли лимиты/идемпотентность.
- [ ] Выполнить платежные интеграции: concurrent idempotency, rate limit и переходы статусов. Очистка не должна удалять Donation, ContactRequest или AdminAuditEvent.

**Готово:** buckets очищаются без платежей, активные лимиты сохраняются, очистка ограничена и безопасна при повторе; платежный запрос больше не ждёт удаления старого backlog.
**Коммиты:** `feat(maintenance): add bounded independent bucket cleanup`; после активации scheduler — `perf(payments): remove bucket cleanup from payment requests`.

## 7. Уменьшать новые редакционные изображения при загрузке

**Создать:** `src/features/uploads/prepare-image.ts`, `prepare-image.test.ts`, `scripts/prepare-brand-images.mjs`.
**Изменить:** `src/features/uploads/store.ts`, `store.test.ts`, `src/features/uploads/object-store.ts`, `object-store.test.ts`, `src/features/uploads/validate.ts`, `validate.test.ts`, `src/app/api/admin/uploads/route.ts`, `route.test.ts`, `src/components/layout/site-header.tsx`, `package.json`, `package-lock.json`.
**Добавить:** `public/brand/mark-small.webp` — производный файл из существующего знака; исходник сохранить.

**Выбор:** один качественный WebP максимум 1440×1440 для новых редакционных загрузок; fit inside, withoutEnlargement, EXIF orientation учитывается, EXIF/GPS не сохраняются. Это даёт сжатие без изменения схемы Project/NewsPost и контракта `{url}`. Многовариантный srcset — последующий этап только при измеренной пользе.

- [ ] Добавить Sharp прямой production-зависимостью совместимой версии и обновить lockfile. В CI проверить Linux native binary на той же Node-ветке, что у runtime.
- [ ] Написать тесты на реальные небольшие fixture-изображения, а не только JPEG magic bytes: результат декодируется как WebP, размеры <=1440, маленький файл не увеличен, EXIF-поворот корректен, прозрачность сохранена, metadata удалены. Отдельно повреждённый файл, слишком большое число пикселей и анимированный WebP.
- [ ] Установить decoder limitInputPixels = 25_000_000, не отключать встроенные ограничения; для редакционных изображений принимать только один кадр и явно отклонять анимацию. Параметры преобразования: `.rotate().resize({width:1440,height:1440,fit:'inside',withoutEnlargement:true}).webp({quality:80,effort:4}).toBuffer()`.
- [ ] Ошибки декодирования преобразовывать в существующий UploadValidationError; сохранить текущую безопасную форму ответа загрузки. Документы PDF проходят прежний путь без Sharp. Не менять банковские QR и изображения, заданные внешними URL.
- [ ] Сохранять подготовленные bytes с detected.extension `webp`, contentType `image/webp` через существующий S3/Blob/local adapter. Имя UUID и `{url}` сохраняются; документ и фото используют раздельные пути. Для immutable UUID-объектов выставить `Cache-Control: public, max-age=31536000, immutable` через поддерживаемые опции каждого адаптера; покрыть object-store тестом.
- [ ] В upload route ограничить фактически прочитанный multipart body до 4_200_000 байт до `formData()`, включая chunked/missing Content-Length. Переиспользовать или выделить общий ограниченный reader из существующего payments/read-limited-body, сохранив платежные API. После ограничения отдельно проверить file.size <=4_000_000 до arrayBuffer/decode. Сохранить origin/session проверки до обработки файла.
- [ ] Учесть ограниченную память: выполнять одну image transform на запрос, не генерировать параллельно несколько размеров, не добавлять неограниченную очередь декодирования. Измерить RSS при пяти одновременных тестовых загрузках; при превышении бюджета runtime ограничить конкуренцию с явным 503/Retry-After, а не копить очередь.
- [ ] Создать знак 104×104 WebP из существующего mark.jpg для шапки 52px при DPR2. Сравнить размер и вид на DPR1/2; если читаемость ухудшилась, скорректировать качество, не перерисовывая бренд. Ссылку в header заменить на производный файл.
- [ ] Не включать серверный next/image optimizer: `images.unoptimized=true` сохраняется. Старые URL и файлы не перезаписывать и не удалять; их обработка — только отдельной задачей с перечнем принадлежащих фонду объектов, если замеры обнаружат проблему.
- [ ] Проверить JPEG/PNG/WebP upload → S3 → preview → опубликованная карточка, PDF upload и QR; повторить UI/доступность тесты и измерить вес фото до/после. Цель для типичного фото — <=300 КиБ, но это цель замера, не основание незаметно отклонять корректный файл.

**Готово:** новые фото ограничены по пикселям и сжаты до сохранения; отсутствует запись в cache/images; старый контент, PDF и QR работают; нет новой миграции БД.
**Коммит:** `perf(media): optimize editorial uploads before object storage`.

## 8. Убрать лишнее чтение в sitemap и выборе назначения платежа

**Изменить:** `src/app/sitemap.ts`, `src/app/seo-routes.test.ts`, `src/features/fundraising/public-projects.ts`, `public-projects.test.ts`; создать `src/features/content-admin/sitemap-repository.ts`, `.test.ts`.

- [ ] Для `listPublishedProjectDonationOptions` выбрать только slug/title с прежним where/order. Отдельный узкий delegate, без полного project list select, fundraising и изменений ответа.
- [ ] Для sitemap создать запросы только slug опубликованных Project/NewsPost и проверку существования опубликованного Document через findFirst с select id. Не читать summary, imageUrl, fileUrl и content ради URL.
- [ ] Сохранить набор публичных маршрутов, порядок и текущий fallback staticEntries при отказе БД. Дополнительную оптимизацию lastModified не смешивать с этим изменением.
- [ ] Написать тесты на сохранение sitemap-поведения и отсутствие лишних полей в запросе; прогнать SEO-route тесты, fundraising тесты, help-page тесты и typecheck.

**Готово:** sitemap и список назначения получают только необходимые данные; SEO и форма оплаты не меняют наблюдаемое поведение.
**Коммит:** `perf(content): narrow sitemap and donation option queries`.

## 9. Сводная проверка, выпуск и откат

**Создать:** `docs/performance/2026-10-19-results.md`.
**Изменить:** `README.md`, `WORK_REPORT.md` — только после фактически выполненных этапов.

- [ ] На согласованном итоговом состоянии выполнить `npm run verify` без опциональных DB-suite переменных, четыре отдельных последовательных DB-прогона из задачи 2, отдельную cleanup-интеграцию, `npm run test:integration:payments` и оба audit с настроенной исключительно тестовой БД. Не включать конфликтующие DB-suite одновременно: pg_trgm общий для БД. Сохранить точные числа passed/failed/skipped и exit codes; каждый DB-suite должен иметь отдельный успешный результат, без skipped.
- [ ] Повторить baseline на той же среде, фикстурах, ресурсах и конкурентности. Привести таблицу до/после: SQL count/rows, p50/p95, ошибка, RSS, байты изображений; не обещать общий процент ускорения без этих данных.
- [ ] Проверить production start в read-only условиях runtime: публичные страницы, админ-вход, загрузка тестового фото, health/readiness. Админку и donation/result проверить на private/no-store. Проверить отсутствие ошибок cache/images.
- [ ] Пройти desktop/mobile 1440 и 390px: главная, карточки, меню, форма обращения, FAQ и страница помощи. Запросы создания оплаты проверять тестовым магазином/моками; реальные пожертвования для smoke не создавать.
- [ ] Выпускать небольшими релизами; после каждого сверять 5xx, p95 и состояние БД. Разделить ошибки приложения, конфигурации и PostgreSQL; health=200 недостаточно.
- [ ] Откат read-оптимизаций — предыдущая совместимая сборка. Перед снятием старой cleanup подтвердить scheduler; при её откате вернуть прежний вызов либо оставить независимую job, не останавливая очистку. Новые WebP читаются и старым UI; объекты не удалять при откате.
- [ ] Выбрать previous artifact, уже совместимый со всеми ранее применёнными миграциями и enum SPAM; не откатывать на произвольную древнюю версию. Схема этим первым релизом не меняется.
- [ ] При регрессии p95 >10% в повторяемых трёх запусках либо новых 5xx/ошибке платежных гарантий остановить выпуск соответствующего этапа, локализовать и откатить его. Изменчивый единичный замер не является достаточным основанием.

**Готово:** функциональные проверки зелёные, нагрузочные показатели воспроизводимы, scheduler наблюдаем, есть конкретный совместимый rollback artifact.

## 10. Решение о межзапросном кеше после измерений

**Файл:** дополнить `docs/performance/2026-10-19-results.md` разделом «Кеш: решение».

- [ ] Применить условие из design: p95 публичного TTFB >500мс после оптимизаций, повторные DB-чтения >=50% серверного времени, подтверждённая возможность достичь цели или уменьшить p95 >=20%. Числа — выбранные критерии проекта, а не уже измеренные результаты.
- [ ] Если условие не выполнено, закончить релиз без общего кеша. Сохранить динамические маршруты, существующую request-дедупликацию и фактические результаты. Это выбранный вариант по умолчанию.
- [ ] Если условие выполнено, следующий отдельный релиз строить на общем Redis рядом с Timeweb-приложением, в допустимом российском размещении. Не делать персистентный кеш в `/app/.next` и не объявлять локальный Map распределённым решением.
- [ ] До кода следующего релиза зафиксировать отдельный cache design: API handler для реально установленной Next.js, совместное хранение и инвалидация между минимум двумя экземплярами, read-after-publish/archive/delete, TTL, ошибка Redis → прямое чтение БД без кеширования ошибочных fallback, бюджет памяти/хранилища, versioned keys при deploy и быстрый bypass-флаг.
- [ ] Для read-after-write определить атомарное изменение версии/инвалидацию, учитывающее гонку одновременной загрузки старого значения и публикации. Один вызов revalidatePath без общего tag/version coordination недостаточен.
- [ ] Кешировать только опубликованные не чувствительные read-модели; суммы сборов отделить от контента. Проверка статуса проекта при создании пожертвования, платежные ответы/статусы, админка, обращения, юридические согласия и реквизиты всегда читаются актуально. Не кешировать null/error как успех.
- [ ] Ввести кеш только если двухэкземплярные тесты инвалидации и замеры подтверждают критерий; иначе оставить прямое чтение и записать причину. Покупка/настройка новой инфраструктуры не входит в исполнение первого релиза.

## Что намеренно отложено

- Пагинация публичных новостей и проектов: это изменение навигации/SEO, требующее отдельного UX-контракта. В первом релизе исправляется неограниченное чтение главной; полные списки сохраняются. Вернуться при заметном росте payload и времени рендера коллекций.
- Перенос chrome в route groups, оптимизация шрифтов, разделение Vitest на node/jsdom: только при подтверждённом вкладе в JS/время проверок. Сейчас нет доказательства, что они важнее перечисленных задач.
- Агрегатная таблица сборов, Redis, новые search-индексы, фоновая обработка изображений: не вводятся без соответствующих замеров.

## Итоговая приёмка первого релиза

- [ ] Текущие пользовательские изменения сохранены и согласованы; исходники не подменены устаревшим снимком.
- [ ] CI реально запускает все нужные проверки; production high/critical = 0, dev advisories обработаны явно.
- [ ] Главная читает максимум три проекта/документа, агрегирует суммы только выбранных ID.
- [ ] Audit-ссылки разрешаются пакетно с сохранением snapshot и безопасного select.
- [ ] Очистка активна при выключенных платежах, ограничена, наблюдаема и не задерживает создание платежа.
- [ ] Новые изображения оптимизируются в памяти, PDF/QR/старые URL сохранены.
- [ ] Sitemap и donation options выбирают только нужные поля.
- [ ] Есть сравнение до/после, результаты DB-suite, решение по кешу и проверенный способ отката.
