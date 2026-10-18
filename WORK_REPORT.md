# Краткий отчет о работе

**Дата:** 24 августа 2026 года
**Статус:** этап 4 реализован в коде; внешняя приемка ЮKassa отложена до тестовых ключей.

## Сделано

- Изучен исходный промт проекта.
- Просмотрены регистрационные документы и варианты логотипа фонда.
- Зафиксированы подтвержденные юридические сведения.
- Изучен сайт-референс [hayra.ru](https://hayra.ru/).
- Выбран основной цвет `#2E7D32` и спокойная редакционная стилистика.
- Уточнен платежный сценарий: только разовое пожертвование через динамический QR СБП.
- Исключены подписки, сохранение карт и автоматические повторные списания.
- Подготовлен файл `PROJECT_PLAN.md` с правилами, архитектурой и этапами.
- Создан проект Next.js с TypeScript, Tailwind CSS, ESLint и Vitest.
- Добавлены дизайн-токены, главная страница, адаптивные header, меню и footer.
- Подключен предоставленный логотип и единый конфиг данных фонда.
- Добавлены Prisma-схема, `.env.example` и инструкции запуска.
- Написано 6 тестов для бренда, навигации и общих компонентов.
- Проверены desktop и mobile: переполнения и ошибок консоли нет.
- Успешно пройдены test, lint, typecheck, Prisma validate, build и npm audit.

## Нужны от владельца

- Домен и production-окружение.
- Доступы тестового и рабочего магазина ЮKassa.
- Оригиналы логотипа в SVG/PNG с прозрачным фоном.
- Проверенные ссылки на документы для публикации.
- Банковские реквизиты фонда.
- Подтвержденные данные команды, проектов, новостей и контактов.
- Проверенные юристом политика, согласия и оферта пожертвования.

## Этап 2

- Собрана полная главная страница в утвержденном варианте C.
- Добавлены страницы фонда, помощи, проектов, контактов и реквизитов.
- Старые редакционные названия направлений удалены.
- Главная и `/projects` показывают только виды деятельности по уставу.
- Карточки деятельности на главной и `/projects` заменены компактным списком утвержденных кратких формулировок видов деятельности.
- Отдельные страницы вымышленных проектов удалены из маршрутов и sitemap.
- Новости, отчеты, банковские данные и юридические тексты оставлены честными заглушками.
- Подготовлена неактивная форма разового платежа через СБП без подписки.
- Настроены metadata, Open Graph, sitemap, robots и Schema.org NGO.
- Добавлено 44 теста, включая доступность, SEO и проверку публичных текстов.
- Проверены desktop и mobile, 404, ссылки, переполнение и консоль браузера.
- Главная сокращена до пяти смысловых секций: удален блок фактов, упрощены формулировки помощи и перенумерованы новости и отчеты.
- Из футера удалена строка ОГРН, ИНН и КПП; бренд, контакты, документы и копирайт сохранены.
- Логотип первого экрана стал адаптивным, центрированным на desktop, tablet и mobile; результат проверен в браузере.

## Следующий шаг

Получить тестовые ключи ЮKassa, утверждённую оферту и пройти живой платёж этапа 5.

## Релиз Admin Operations — 17 октября 2026 года

Реализована защищенная очередь обращений и единый операционный dashboard. Все
чтения dashboard выполняются через один server read model, изменения обращений и
контента пишут privacy-safe audit в той же транзакции, а календарные метрики
пожертвований считаются по `Europe/Moscow` и `paidAt`.

### Матрица T1–T10

| Задача | Реализация и проверка |
| --- | --- |
| T1 — модель и миграция | `prisma/schema.prisma`, `20261016000000_admin_operations`, unit/schema tests и `admin-operations-migration.integration.test.ts`: `SPAM`, `internalNote`, audit enums/table, B-tree/GIN индексы, сохранение legacy rows. |
| T2 — API списка | `admin-messages/filters.ts` и `repository.ts`: строгие query-параметры, поиск по имени/email/тексту, статус/даты, `RepeatableRead`, count и страницы по 25; repository/filter tests. |
| T3 — изменение обращения | `admin-messages/mutation.ts`: auth-first, canonical `updatedAt`, optimistic `updateMany`, понятный conflict, сохранение безопасных значений; mutation/action/form tests. |
| T4 — журнал действий | `admin-audit/events.ts`, audited content/contact repositories: allow-list событий без PII/текстов/секретов, atomic audit и no-op/error правила; unit tests и DB-gated rollback test. |
| T5 — read model | `admin-dashboard/read-model.ts`: одна `RepeatableRead`-транзакция для счетчиков, alerts и 10 последних безопасных действий; query-shape/page tests. |
| T6 — пожертвования | `moscow.ts` и dashboard aggregates: `SUCCEEDED`, `paidAt`, московские day/month `[start,end)`, null sum → 0; boundary tests и DB-gated integration. |
| T7 — предупреждения | `admin-dashboard/alerts.ts`, `readiness/evaluate.ts`: строгие 48ч/1ч cutoff и безопасный `ADMIN_AUTH`; unit/route tests. |
| T8 — badge | protected layout → `AdminShell` → `AdminNav`: после сессии передается только число `NEW`, без API/fetch; shell/nav/a11y tests. |
| T9 — интеграция | `admin-operations.integration.test.ts` использует реальные repositories/wrappers в случайной схеме и проверяет поиск, SQL predicates, границы, audit privacy, public no-audit и forced rollback. Текущий DB-прогон unavailable: безопасный URL не задан. |
| T10 — release review | Полные unit/a11y tests, lint, typecheck, Prisma validate, production build, dependency audit, статический security/query review. Authenticated desktop/mobile smoke и `EXPLAIN` unavailable без безопасной БД. |

### L13 — эксплуатационная документация

- README фиксирует владение `pg_trgm`, резервную копию и окно обслуживания,
  защищённые локальные DB-команды и точные строгие пороги `NEW`/`PENDING`.
- Для отката описан предпочтительный forward-fix и совместимый артефакт с
  перегенерированным Prisma Client, который знает enum `SPAM`; исходная сборка
  после возможной записи `SPAM` считается небезопасной.
- Аварийный remap `SPAM → IN_PROGRESS` требует backup, остановку записи, явный
  count, одобренную транзакцию и операторский журнал изменений. Потеря
  классификации отмечена как lossy.
- Destructive automatic down отсутствует: аддитивная схема сохраняется, а
  поздняя очистка возможна только отдельной reviewed maintenance migration после
  свежей копии и доказанного отсутствия `SPAM` и использования
  `internalNote`/audit. Текущие сведения о DB- и browser-проверках не изменены.

### Проверки релиза

- Финальная проверка выполнена 18 октября 2026 года на итоговом состоянии ветки
  после `npm ci`; `package-lock.json` восстановлен точно к base `1d480ed`.
- `npm ci`: exit 0, установлено 495 пакетов из восстановленного lockfile.
- Focused UI/domain suite: 14 файлов и 91 тест passed, 0 skipped/failed.
- `npm run verify`: exit 0. Входящий в него `npm test` завершил 124 файла
  passed и 4 DB-gated suites skipped; 1290 тестов passed, 12 skipped.
- `npm run lint`: 0 errors; остается одно существующее предупреждение
  `@next/next/no-img-element` для QR в `bank-qr-transfer.tsx`.
- `npm run typecheck`: passed.
- `npm run db:validate` с безопасным placeholder URL: passed, подключения к БД
  команда не выполняет.
- `npm run build`: passed на Next.js 16.3.1; все защищенные `/admin` маршруты,
  включая страницы создания, подтверждены как dynamic.
- `npm audit --omit=dev`: exit 1, 4 production vulnerabilities — 3 high и
  1 critical (`next`, `sharp`, `source-map-js`, вложенный в `@vercel/blob`
  `undici`).
- Полный `npm audit`: exit 1, 11 vulnerabilities — 10 high и 1 critical;
  дополнительно затронуты dev-зависимости `brace-expansion`, `braces`, `js-yaml`
  и `undici`. `npm audit fix` не применялся, поскольку он изменил бы
  восстановленный baseline lock; вариант с `--force` также предлагает ломающий
  downgrade `eslint-config-next`.
- `ADMIN_OPERATIONS_TEST_DATABASE_URL`, `CONTENT_MIGRATION_TEST_DATABASE_URL`,
  `CONTENT_REPOSITORY_TEST_DATABASE_URL`, `PAYMENTS_TEST_DATABASE_URL` и
  `DATABASE_URL` в среде отсутствовали. Соответствующие PostgreSQL suites не
  запускались и не считаются прошедшими.
- Authenticated browser smoke на 1440×900 и 390×844 и реальные `EXPLAIN` не выполнялись:
  безопасная локальная БД, `ADMIN_USERNAME` и `ADMIN_PASSWORD` не предоставлены.
  Responsive/a11y поведение покрыто component, CSS-contract и axe тестами, но не
  выдается за браузерную приемку.

### Security и запросы

- Все затронутые protected pages/actions проверяют сессию до разбора входа и
  обращения к репозиторию. Отказ авторизации отдельно параметризован для всех
  11 content/requisites mutations. Публичная контактная форма остается
  отдельной и не пишет audit.
- Audit schema и constructors допускают только action/entity/status fields;
  message, note, email, name, content и произвольный JSON структурно отсутствуют.
- Contact mutation защищена canonical timestamp и условным `id + updatedAt`;
  изменение данных и audit находятся в одной транзакции.
- Индексы согласованы с predicates: `(status, createdAt, id)` для очереди и
  stale NEW, три `pg_trgm` GIN для `contains`, `(status, paidAt)` для московских
  aggregates, существующий `(status, createdAt)` для stale PENDING и
  `(createdAt, id)` для recent audit. Фактические `EXPLAIN` должны быть сняты на
  безопасной PostgreSQL базе перед production rollout.
- Поисковая строка может содержать PII; production proxy должен подавлять query
  string для всех `/admin` URL. Ответы админки остаются `private, no-store`.

## Этап 4: ЮKassa и СБП

- Добавлен серверный контур разового платежа СБП: `POST /api/payments/create`,
  webhook ЮKassa и страница `/donation/result`.
- Форма на `/help` остаётся выключенной, пока `PAYMENTS_ENABLED=false` или оферта
  не опубликована. Имя, email и чек не собираются.
- Статус в базе меняется только после авторизованного GET платежа в ЮKassa.
- Повторы блокируются UUID/Idempotence-Key, уникальными индексами и условными
  переходами `PENDING → SUCCEEDED|CANCELED`.
- Добавлены unit-тесты и обязательная PostgreSQL-команда
  `npm run test:integration:payments`.
- Живой QR, возврат из тестового магазина и production webhook остаются в этапе 5.

## Этап 3: контент и админка

- Добавлены авторизация и единая административная часть `/admin` с обзором,
  проектами, новостями, документами, реквизитами и пожертвованиями.
- Реализованы создание и редактирование проектов, новостей и документов, а также
  редактирование реквизитов.
- Для контента используются статусы `DRAFT`, `PUBLISHED` и `ARCHIVED`; публичные
  страницы, отдельные материалы и sitemap включают только `PUBLISHED`.
- Изображения и документы задаются URL. Загрузка файлов и обязательный формат PDF
  не реализованы.
- Добавлена миграция публикации с заполнением статусов документов и дат ранее
  опубликованных проектов и новостей.
- Интеграционный тест миграции ограничен локальным PostgreSQL и базой с суффиксом
  `_test`, использует временную схему и ограниченные таймауты.
- В `/admin/donations` реализованы серверные фильтры по статусу, московскому
  периоду создания, имени, email и идентификатору платежа.
- Добавлены согласованная пагинация по 50 строк и стабильная сортировка.
- CSV выгружает только текущую отфильтрованную выборку, читая данные пакетами.
- Экспорт защищен от формул, не содержит `idempotenceKey` и не кешируется.
- Добавлена отдельная Prisma-миграция индекса списка пожертвований.
- Локальная PostgreSQL 14 запущена, начальная миграция и миграция списка
  пожертвований применены; пустое состояние списка проверено в браузере на
  подключенной базе.
- После реализации Stage 3 успешно пройдены `npm test` (565 тестов),
  `npm run lint`, `npm run typecheck`, `npm run build` и
  `npm run db:validate`.
- Четыре opt-in теста в двух PostgreSQL integration suites пропущены без
  `CONTENT_MIGRATION_TEST_DATABASE_URL` и `CONTENT_REPOSITORY_TEST_DATABASE_URL`.
  Миграции отдельно применены и проверены на временной базе, затем применены к
  локальной базе разработки.
- Browser CRUD QA выполнен на отдельной базе: проверены вход, черновик,
  публикация, sitemap, смена slug, архивирование и удаление проекта, а также
  публикация и архивирование новости, документа и реквизитов.
- В списке пожертвований подтверждено, что фильтр по статусу показывает только
  выбранный статус. Privacy headers присутствуют, ошибок консоли браузера нет.
- Встроенный браузер не применил запрошенный viewport 390 px и оставался на
  1280 px; мобильные responsive-контракты покрыты автоматическими тестами, но
  точная визуальная перепроверка на 390 px в этой сессии не выполнена.
