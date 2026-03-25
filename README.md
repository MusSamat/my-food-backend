# Food Delivery Backend — Telegram Mini App

Express.js + PostgreSQL backend для системы заказа еды через Telegram Mini App с оплатой Finik Pay.

## Структура проекта

```
backend/
├── src/
│   ├── index.js                    # Точка входа, Express app
│   ├── config/index.js             # Загрузка .env, конфиг
│   ├── db/
│   │   ├── pool.js                 # PG connection pool
│   │   ├── migrations/001_initial.js  # Полная схема БД
│   │   └── seeds/001_demo.js       # Демо-данные
│   ├── middleware/
│   │   ├── errorHandler.js         # AsyncHandler + AppError + глобальный handler
│   │   ├── auth.js                 # JWT авторизация (admin)
│   │   ├── telegram.js             # Валидация Telegram initData
│   │   └── upload.js               # Multer + Sharp (image upload)
│   └── modules/
│       ├── auth/routes.js          # POST /login, GET /me
│       ├── categories/routes.js    # Public + Admin CRUD
│       ├── items/routes.js         # Public (list, popular, search) + Admin CRUD
│       ├── offices/routes.js       # Public + Admin CRUD
│       ├── promos/routes.js        # Validate + Admin CRUD
│       ├── orders/routes.js        # Создание заказа + оплата + Admin управление
│       ├── payments/
│       │   ├── service.js          # Finik Pay API (create, verify, check)
│       │   └── routes.js           # POST /webhooks/finik
│       ├── print/
│       │   ├── service.js          # Генерация чеков (HTML, ESC/POS, PDF)
│       │   └── routes.js           # Receipt endpoints + printer settings
│       ├── stats/routes.js         # Dashboard статистика
│       └── telegram/service.js     # Bot (/start, уведомления)
├── scripts/
│   ├── migrate.js                  # CLI: npm run migrate / migrate:down
│   └── seed.js                     # CLI: npm run seed
├── uploads/                        # Загруженные изображения
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Требования

- **Node.js** >= 18
- **PostgreSQL** >= 14
- **npm** >= 9

## Установка

### 1. Клонирование и установка зависимостей

```bash
cd backend
npm install
```

### 2. Настройка переменных окружения

```bash
cp .env.example .env
```

Откройте `.env` и заполните:

```env
# Обязательные:
DB_PASSWORD=your_db_password
JWT_SECRET=сгенерируйте_длинную_строку
TELEGRAM_BOT_TOKEN=получите_у_@BotFather
MINI_APP_URL=https://your-domain.com/menu

# Finik Pay (после регистрации на finik.kg):
FINIK_API_KEY=ваш_ключ
FINIK_SECRET_KEY=ваш_секретный_ключ
FINIK_CALLBACK_URL=https://api.your-domain.com/api/webhooks/finik
FINIK_REDIRECT_URL=https://your-domain.com/order-status
```

### 3. Создание базы данных

```bash
# Войдите в psql
psql -U postgres

# Создайте БД
CREATE DATABASE food_delivery;
\q
```

### 4. Миграция и seed

```bash
# Создать все таблицы
npm run migrate

# Заполнить демо-данными (категории, блюда, офисы, промокоды, admin)
npm run seed

# Или одной командой:
npm run setup
```

### 5. Запуск

```bash
# Development (с авто-перезагрузкой)
npm run dev

# Production
npm start
```

Сервер запустится на `http://localhost:4000`.

## API Reference

### Public (Mini App)

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/categories` | Все категории с блюдами |
| GET | `/api/items?category_id=X` | Блюда по категории |
| GET | `/api/items/popular` | Часто заказываемые |
| GET | `/api/items/search?q=text` | Поиск блюд |
| GET | `/api/items/:id` | Одно блюдо |
| GET | `/api/offices` | Список офисов |
| POST | `/api/promo/validate` | Проверка промокода |
| POST | `/api/orders` | Создание заказа → возвращает payment_url |
| GET | `/api/orders/:id/status` | Статус заказа |
| GET | `/api/health` | Health check |

### Webhook

| Method | Endpoint | Описание |
|--------|----------|----------|
| POST | `/api/webhooks/finik` | Callback от Finik Pay |

### Admin (требуется Bearer token)

| Method | Endpoint | Описание |
|--------|----------|----------|
| POST | `/api/admin/auth/login` | Вход (username + password) |
| GET | `/api/admin/auth/me` | Текущий админ |
| CRUD | `/api/admin/categories` | Управление категориями |
| CRUD | `/api/admin/items` | Управление блюдами (с upload изображений) |
| CRUD | `/api/admin/offices` | Управление офисами |
| CRUD | `/api/admin/promos` | Управление промокодами |
| GET | `/api/admin/orders` | Список заказов (фильтры: status, type, date) |
| GET | `/api/admin/orders/:id` | Детали заказа |
| PATCH | `/api/admin/orders/:id/status` | Смена статуса |
| GET | `/api/admin/stats` | Статистика |

### Print (admin)

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/admin/orders/:id/receipt/kitchen` | Кухонный чек (HTML) |
| GET | `/api/admin/orders/:id/receipt/client` | Клиентский чек (HTML) |
| GET | `/api/admin/orders/:id/receipt/pdf` | Клиентский чек (PDF) |
| POST | `/api/admin/orders/:id/print/kitchen` | Печать на термопринтер (кухня) |
| POST | `/api/admin/orders/:id/print/client` | Печать на термопринтер (клиент) |
| POST | `/api/admin/printer/test` | Тестовая печать |
| GET | `/api/admin/settings/printer` | Настройки принтера |
| PUT | `/api/admin/settings/printer` | Сохранить настройки принтера |

## Примеры запросов

### Логин админа

```bash
curl -X POST http://localhost:4000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### Создание заказа

```bash
curl -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_user_id": 123456789,
    "type": "delivery",
    "name": "Муса",
    "phone": "+996773000000",
    "address": "ул. Ибраимова, 115/3",
    "items": [
      {"id": 1, "quantity": 2},
      {"id": 4, "quantity": 1}
    ],
    "promo_code": "WELCOME15",
    "cutlery_count": 2
  }'
```

### Проверка промокода

```bash
curl -X POST http://localhost:4000/api/promo/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME15", "subtotal": 1000}'
```

## Деплой

### Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /path/to/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### PM2

```bash
npm install -g pm2
pm2 start src/index.js --name food-delivery-api
pm2 save
pm2 startup
```

## Демо-аккаунт

- **Login**: admin
- **Password**: admin123
