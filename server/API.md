# API

Base URL: `http://localhost:3000/api`

Все маршруты проектов требуют заголовок:

```text
Authorization: Bearer <JWT>
```

## POST /api/auth/login

```json
{
  "email": "admin@example.com",
  "password": "your-password"
}
```

Регистрации нет.

## GET /api/health

Проверка сервера и PostgreSQL.

## GET /api/me

Возвращает текущий единственный аккаунт.

## GET /api/projects

Список проектов без тяжёлого `document`.

## GET /api/projects/:projectId

Один проект вместе с `document`.

## POST /api/projects

```json
{
  "id": "project_optional",
  "title": "Название",
  "schemaVersion": 2,
  "document": {
    "schemaVersion": 2,
    "project": {},
    "ui": {}
  }
}
```

`id` можно не передавать.
`document` можно передать как объект или JSON-строку.

## PUT /api/projects/:projectId

```json
{
  "title": "Название",
  "schemaVersion": 2,
  "document": {},
  "revision": 1
}
```

После сохранения `revision` увеличивается на 1.
При устаревшей ревизии сервер отвечает `409`.

## DELETE /api/projects/:projectId

Удаляет проект.
