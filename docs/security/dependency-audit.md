# Dependency audit — 17 ноября 2026

Production: `npm audit --omit=dev --audit-level=high` — **0 уязвимостей** после обновления Next.js/eslint-config-next до 16.4.6, @vercel/blob до 2.9.0 и Zod до совместимого 4.6.7 через npm override. Override нужен из-за зафиксированной транзитивной версии Zod у @vercel/cli-config; удалить после исправления upstream. Vercel Blob сохранён для совместимости preview, production использует Timeweb S3.

Полный audit: **16 записей high**, относящихся к одной корневой проблеме [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) в picomatch. Advisory 17 ноября указывает affected <=4.0.7, patched versions отсутствуют. Это dev-цепочки Next ESLint/TypeScript ESLint/Vitest/Vite/glob, не production-зависимости. Vite обновлён до 8.3.8 в допустимом диапазоне Vitest, устранив прежние Vite advisory.

Не применять `npm audit fix --force`: предлагаемые откаты ESLint/Vitest через major не являются проверенным исправлением. Порог production CI не ослаблен. Непроверенные glob-паттерны нельзя подставлять в конфигурацию линтера, тестов и сборки. Сервис приложения не использует эти инструменты для HTTP-параметров. Это ограничение достижимости, а не исправление самой dev-уязвимости.

До следующего выпуска повторить оба audit. Ответственный: сопровождающий проекта; следующая плановая проверка — 24 ноября 2026. Проверять upstream picomatch, `npm explain picomatch`, `npm explain zod`, совместимость override и свежий lockfile.

После обновления `npm run verify` прошёл, включая 1571 unit/компонентный тест, lint, TypeScript, Prisma и build; браузерные сценарии14/14. Интеграционные результаты и ограничения production фиксируются в журнале исправлений.
