# filesystem10 — готовый однопользовательский backend

Это backend именно для текущего этапа проекта:

- PostgreSQL;
- один общий логин и пароль;
- JWT;
- хранение полного проекта в JSONB;
- список проектов;
- загрузка одного проекта;
- создание;
- сохранение;
- удаление;
- revision для защиты от случайной перезаписи;
- без регистрации;
- без участников;
- без ролей;
- без воркспейсов;
- без многопользовательского доступа.

## Установка

```powershell
cd server
npm install
```

## Создай .env

```powershell
Copy-Item .env.example .env
```

Заполни данные PostgreSQL.

## Создай хэш общего пароля

```powershell
npm run hash-password -- "MyStrongPassword123"
```

Скопируй полученный `$2b$...` в:

```text
APP_PASSWORD_HASH=...
```

В `APP_EMAIL` укажи общий логин.

## JWT secret

Замени:

```text
JWT_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_SECRET
```

на длинную случайную строку.

## База данных

Backend сам создаёт таблицу `single_user_projects` при запуске.
При желании можно выполнить отдельно:

```powershell
npm run db:init
```

Старые таблицы многопользовательского backend не удаляются и не изменяются.

## Запуск

```powershell
npm run dev
```

Ожидаемо:

```text
Server started: http://localhost:3000
```

## Проверка health

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3000/api/health"
```

## Проверка входа

```powershell
$body = @{
  email = "admin@example.com"
  password = "MyStrongPassword123"
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/auth/login" `
  -ContentType "application/json" `
  -Body $body

$token = $login.token
$headers = @{ Authorization = "Bearer $token" }
```

## Список проектов

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3000/api/projects" `
  -Headers $headers
```

## Создать тестовый проект

```powershell
$projectBody = @{
  id = "project_test"
  title = "Тестовый проект"
  schemaVersion = 2
  document = @{
    schemaVersion = 2
    project = @{
      root = @{
        id = "root"
        level = 0
        name = "Тестовый проект"
        children = @()
      }
    }
    ui = @{
      selectedId = "root"
    }
  }
} | ConvertTo-Json -Depth 20

$created = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/projects" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $projectBody
```

## Важно про frontend

Этот архив — законченный backend.

Но текущий frontend всё ещё использует локальный `projectRepository` / `autosave.js`.
Чтобы реальные пользовательские проекты начали уходить в PostgreSQL, следующим этапом
нужно заменить локальный repository на API repository, который вызывает:

```text
POST   /api/auth/login
GET    /api/projects
GET    /api/projects/:id
POST   /api/projects
PUT    /api/projects/:id
DELETE /api/projects/:id
```

Формат `document` backend не меняет: он хранит целиком снимок проекта, который уже
формирует frontend.
