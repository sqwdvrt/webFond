# Dependency audit — 19 октября 2026 года

Production-зависимости: `npm audit --omit=dev --audit-level=high` — 0 уязвимостей.

Полный audit: 5 записей high, относящихся к одной корневой проблеме
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

Цепочка, целиком dev-only:

`eslint-config-next@16.4.2 → @next/eslint-plugin-next@16.4.2 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`.

На дату проверки registry latest braces — 3.0.3, исправленной версии в advisory
нет. Совместимого стабильного исправления в Next ESLint также нет. Предлагаемый
`npm audit fix --force` откатывает eslint-config-next на 14.2.35 и не применяется.

Воздействие: глубоко вложенный brace-шаблон может завершить процесс обработки
glob через переполнение стека. Эта цепочка используется линтером. Проверенная
конфигурация ESLint не задаёт `settings.next.rootDir`; установленный плагин в
этом случае использует cwd непосредственно, без передачи rootDir в fast-glob.
HTTP-параметры приложения в эту цепочку не поступают.

Временное решение до upstream-исправления: сохранять glob-шаблоны конфигурации
под контролем сопровождающих; не подставлять внешние или генерируемые из
недоверенных данных шаблоны в `settings.next.rootDir`. Production audit остаётся
обязательной проверкой CI; полный audit не скрывается и запускается при выпуске.
Это документированный остаточный риск dev-инструментария, а не исправление
уязвимости или отключение всех будущих advisory.

Ответственный: сопровождающий зависимостей/CI проекта. Повторная проверка
registry и advisory — **2 ноября 2026 года**. При появлении совместимого патча
обновить lockfile и выполнить lint, tests, typecheck, build и оба audit.

Проверка: `npm explain braces`, `npm audit --json`, `npm view braces version`,
`npm view eslint-config-next version`, production-only audit. Значения npm registry
перепроверять на дату следующего выпуска.
