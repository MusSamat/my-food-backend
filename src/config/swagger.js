const swaggerSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Food Delivery API',
        version: '1.0.0',
        description: 'Telegram Mini App — система заказа еды с оплатой Finik Pay',
        contact: { email: 'dev@example.com' },
    },
    servers: [
        { url: 'http://localhost:4000', description: 'Development' },
    ],
    tags: [
        { name: 'Public — Menu', description: 'Категории, блюда, поиск (Mini App)' },
        { name: 'Public — Orders', description: 'Создание заказа и статус' },
        { name: 'Public — Promo', description: 'Проверка промокодов' },
        { name: 'Public — Offices', description: 'Список офисов/филиалов' },
        { name: 'Webhook', description: 'Callback от Finik Pay' },
        { name: 'Admin — Auth', description: 'Авторизация админа' },
        { name: 'Admin — Categories', description: 'CRUD категорий' },
        { name: 'Admin — Items', description: 'CRUD блюд' },
        { name: 'Admin — Orders', description: 'Управление заказами' },
        { name: 'Admin — Offices', description: 'CRUD офисов' },
        { name: 'Admin — Promos', description: 'CRUD промокодов' },
        { name: 'Admin — Print', description: 'Печать чеков' },
        { name: 'Admin — Stats', description: 'Статистика' },
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Получите токен через POST /api/admin/auth/login',
            },
        },
        schemas: {
            Category: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 1 },
                    name_ru: { type: 'string', example: 'Суши' },
                    name_kg: { type: 'string', example: 'Суши' },
                    icon: { type: 'string', example: '🍣' },
                    sort_order: { type: 'integer', example: 1 },
                    is_active: { type: 'boolean', example: true },
                    items: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Item' },
                    },
                },
            },
            CategoryInput: {
                type: 'object',
                required: ['name_ru'],
                properties: {
                    name_ru: { type: 'string', example: 'Пиццы' },
                    name_kg: { type: 'string', example: 'Пиццалар' },
                    icon: { type: 'string', example: '🍕' },
                    sort_order: { type: 'integer', example: 1 },
                    is_active: { type: 'boolean', example: true },
                },
            },
            Item: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 1 },
                    category_id: { type: 'integer', example: 1 },
                    name_ru: { type: 'string', example: 'Филадельфия' },
                    name_kg: { type: 'string', example: 'Филадельфия' },
                    description_ru: { type: 'string', example: 'Классический ролл с лососем' },
                    description_kg: { type: 'string' },
                    ingredients: { type: 'string', example: 'лосось, сливочный сыр, рис, нори' },
                    price: { type: 'integer', example: 545, description: 'Цена в сомах' },
                    image_url: { type: 'string', example: '/uploads/abc123.webp' },
                    status: { type: 'string', enum: ['available', 'coming_soon', 'out_of_stock', 'hidden'], example: 'available' },
                    is_popular: { type: 'boolean', example: true },
                    sort_order: { type: 'integer', example: 1 },
                },
            },
            Office: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 1 },
                    name: { type: 'string', example: 'Главный офис' },
                    address: { type: 'string', example: 'г. Бишкек, ул. Ибраимова, 115' },
                    phone: { type: 'string', example: '+996 555 123 456' },
                    working_hours: { type: 'string', example: '10:00 - 23:00' },
                    is_active: { type: 'boolean', example: true },
                },
            },
            PromoCode: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 1 },
                    code: { type: 'string', example: 'WELCOME15' },
                    type: { type: 'string', enum: ['percent', 'fixed'], example: 'percent' },
                    value: { type: 'integer', example: 15, description: '15 = 15% или 200 = 200 сом' },
                    min_order: { type: 'integer', example: 500 },
                    max_uses: { type: 'integer', example: 100 },
                    used_count: { type: 'integer', example: 12 },
                    valid_from: { type: 'string', format: 'date-time' },
                    valid_to: { type: 'string', format: 'date-time' },
                    is_active: { type: 'boolean', example: true },
                },
            },
            OrderCreate: {
                type: 'object',
                required: ['telegram_user_id', 'name', 'phone', 'items'],
                properties: {
                    telegram_user_id: { type: 'integer', example: 123456789, description: 'Telegram user ID' },
                    telegram_username: { type: 'string', example: 'john_doe' },
                    type: { type: 'string', enum: ['delivery', 'pickup'], example: 'delivery' },
                    name: { type: 'string', example: 'Муса' },
                    phone: { type: 'string', example: '+996773000000' },
                    address: { type: 'string', example: 'ул. Ибраимова, 115/3', description: 'Обязательно для delivery' },
                    apartment: { type: 'string', example: '42' },
                    floor: { type: 'string', example: '3' },
                    entrance: { type: 'string', example: '2' },
                    courier_comment: { type: 'string', example: 'Не звонить, домофон 57' },
                    office_id: { type: 'integer', example: 1, description: 'Для самовывоза' },
                    comment: { type: 'string', example: 'Без лука' },
                    cutlery_count: { type: 'integer', example: 2 },
                    promo_code: { type: 'string', example: 'WELCOME15' },
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['id', 'quantity'],
                            properties: {
                                id: { type: 'integer', example: 1, description: 'ID блюда' },
                                quantity: { type: 'integer', example: 2, minimum: 1 },
                            },
                        },
                    },
                },
            },
            Order: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 1 },
                    telegram_user_id: { type: 'integer' },
                    type: { type: 'string', enum: ['delivery', 'pickup'] },
                    status: { type: 'string', enum: ['pending_payment', 'paid', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'] },
                    name: { type: 'string' },
                    phone: { type: 'string' },
                    address: { type: 'string' },
                    subtotal: { type: 'integer' },
                    discount: { type: 'integer' },
                    delivery_fee: { type: 'integer' },
                    total: { type: 'integer' },
                    payment_status: { type: 'string', enum: ['pending', 'success', 'failed'] },
                    items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
                    created_at: { type: 'string', format: 'date-time' },
                },
            },
            OrderItem: {
                type: 'object',
                properties: {
                    item_name: { type: 'string', example: 'Филадельфия' },
                    quantity: { type: 'integer', example: 2 },
                    price: { type: 'integer', example: 545 },
                },
            },
            PrinterSettings: {
                type: 'object',
                properties: {
                    connection_type: { type: 'string', enum: ['usb', 'lan', 'browser'], example: 'lan' },
                    ip_address: { type: 'string', example: '192.168.1.100' },
                    port: { type: 'integer', example: 9100 },
                    paper_width: { type: 'string', enum: ['80mm', '58mm'], example: '80mm' },
                    auto_print_kitchen: { type: 'boolean', example: true },
                    auto_print_client: { type: 'boolean', example: false },
                },
            },
            Stats: {
                type: 'object',
                properties: {
                    today: {
                        type: 'object',
                        properties: {
                            orders: { type: 'integer', example: 24 },
                            revenue: { type: 'integer', example: 18500 },
                        },
                    },
                    week: {
                        type: 'object',
                        properties: {
                            orders: { type: 'integer', example: 156 },
                            revenue: { type: 'integer', example: 125000 },
                        },
                    },
                    avg_check: { type: 'integer', example: 780 },
                    active_orders: { type: 'integer', example: 5 },
                    top_items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                item_name: { type: 'string' },
                                total_qty: { type: 'integer' },
                                total_sum: { type: 'integer' },
                            },
                        },
                    },
                },
            },
            Error: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Ошибка валидации' },
                },
            },
        },
    },
    paths: {
        // ═══════════════════════════════════════
        // PUBLIC — MENU
        // ═══════════════════════════════════════
        '/api/categories': {
            get: {
                tags: ['Public — Menu'],
                summary: 'Все категории с блюдами',
                description: 'Возвращает список активных категорий, в каждой — массив блюд (кроме hidden)',
                responses: {
                    200: {
                        description: 'Список категорий',
                        content: { 'application/json': { schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                data: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
                            },
                        }}},
                    },
                },
            },
        },
        '/api/items': {
            get: {
                tags: ['Public — Menu'],
                summary: 'Блюда по категории',
                parameters: [
                    { name: 'category_id', in: 'query', schema: { type: 'integer' }, description: 'ID категории' },
                ],
                responses: { 200: { description: 'Список блюд' } },
            },
        },
        '/api/items/popular': {
            get: {
                tags: ['Public — Menu'],
                summary: 'Часто заказываемые блюда',
                description: 'Топ-10 блюд с is_popular=true и status=available',
                responses: { 200: { description: 'Список популярных блюд' } },
            },
        },
        '/api/items/search': {
            get: {
                tags: ['Public — Menu'],
                summary: 'Поиск блюд',
                description: 'Ищет по name_ru, name_kg, description_ru, ingredients. Минимум 2 символа.',
                parameters: [
                    { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 }, example: 'пицца' },
                ],
                responses: { 200: { description: 'Результаты поиска' } },
            },
        },
        '/api/items/{id}': {
            get: {
                tags: ['Public — Menu'],
                summary: 'Одно блюдо по ID',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
                ],
                responses: {
                    200: { description: 'Данные блюда' },
                    404: { description: 'Блюдо не найдено' },
                },
            },
        },

        // ═══════════════════════════════════════
        // PUBLIC — OFFICES
        // ═══════════════════════════════════════
        '/api/offices': {
            get: {
                tags: ['Public — Offices'],
                summary: 'Список активных офисов/филиалов',
                responses: { 200: { description: 'Список офисов' } },
            },
        },

        // ═══════════════════════════════════════
        // PUBLIC — PROMO
        // ═══════════════════════════════════════
        '/api/promo/validate': {
            post: {
                tags: ['Public — Promo'],
                summary: 'Проверить промокод',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: {
                        type: 'object',
                        required: ['code', 'subtotal'],
                        properties: {
                            code: { type: 'string', example: 'WELCOME15' },
                            subtotal: { type: 'integer', example: 1000, description: 'Сумма заказа в сомах' },
                        },
                    }}},
                },
                responses: {
                    200: { description: 'Промокод валиден, возвращает размер скидки' },
                    400: { description: 'Промокод исчерпан или минимальная сумма не достигнута' },
                    404: { description: 'Промокод не найден или истёк' },
                },
            },
        },

        // ═══════════════════════════════════════
        // PUBLIC — ORDERS
        // ═══════════════════════════════════════
        '/api/orders': {
            post: {
                tags: ['Public — Orders'],
                summary: 'Создать заказ и получить ссылку на оплату',
                description: 'Создаёт заказ, проверяет наличие блюд, применяет промокод, вызывает Finik API. Возвращает payment_url для редиректа на оплату.',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderCreate' } } },
                },
                responses: {
                    201: {
                        description: 'Заказ создан',
                        content: { 'application/json': { schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                data: {
                                    type: 'object',
                                    properties: {
                                        order_id: { type: 'integer', example: 1 },
                                        total: { type: 'integer', example: 1204 },
                                        payment_url: { type: 'string', example: 'https://pay.finik.kg/p/abc123' },
                                    },
                                },
                            },
                        }}},
                    },
                    400: { description: 'Ошибка валидации' },
                    502: { description: 'Ошибка создания платежа в Finik' },
                },
            },
        },
        '/api/orders/{id}/status': {
            get: {
                tags: ['Public — Orders'],
                summary: 'Статус заказа',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
                ],
                responses: {
                    200: { description: 'Статус и детали заказа' },
                    404: { description: 'Заказ не найден' },
                },
            },
        },

        // ═══════════════════════════════════════
        // WEBHOOK
        // ═══════════════════════════════════════
        '/api/webhooks/finik': {
            post: {
                tags: ['Webhook'],
                summary: 'Callback от Finik Pay',
                description: 'Finik вызывает этот endpoint при изменении статуса платежа. Проверяет подпись, обновляет заказ, отправляет уведомление, запускает автопечать.',
                requestBody: {
                    content: { 'application/json': { schema: {
                        type: 'object',
                        properties: {
                            payment_id: { type: 'string' },
                            order_id: { type: 'string' },
                            status: { type: 'string', enum: ['success', 'failed', 'pending'] },
                            signature: { type: 'string' },
                        },
                    }}},
                },
                responses: { 200: { description: 'OK' } },
            },
        },

        // ═══════════════════════════════════════
        // ADMIN — AUTH
        // ═══════════════════════════════════════
        '/api/admin/auth/login': {
            post: {
                tags: ['Admin — Auth'],
                summary: 'Логин администратора',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: {
                        type: 'object',
                        required: ['username', 'password'],
                        properties: {
                            username: { type: 'string', example: 'admin' },
                            password: { type: 'string', example: 'admin123' },
                        },
                    }}},
                },
                responses: {
                    200: {
                        description: 'Успешный вход',
                        content: { 'application/json': { schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean' },
                                data: {
                                    type: 'object',
                                    properties: {
                                        token: { type: 'string', description: 'JWT токен для Authorization: Bearer ...' },
                                        admin: { type: 'object', properties: { id: { type: 'integer' }, username: { type: 'string' }, name: { type: 'string' } } },
                                    },
                                },
                            },
                        }}},
                    },
                    401: { description: 'Неверный логин или пароль' },
                },
            },
        },
        '/api/admin/auth/me': {
            get: {
                tags: ['Admin — Auth'],
                summary: 'Текущий админ',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Данные текущего админа' } },
            },
        },

        // ═══════════════════════════════════════
        // ADMIN — CATEGORIES
        // ═══════════════════════════════════════
        '/api/admin/categories': {
            get: {
                tags: ['Admin — Categories'],
                summary: 'Все категории (включая неактивные)',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Список категорий' } },
            },
            post: {
                tags: ['Admin — Categories'],
                summary: 'Создать категорию',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryInput' } } },
                },
                responses: { 201: { description: 'Создано' } },
            },
        },
        '/api/admin/categories/{id}': {
            put: {
                tags: ['Admin — Categories'],
                summary: 'Обновить категорию',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryInput' } } } },
                responses: { 200: { description: 'Обновлено' }, 404: { description: 'Не найдено' } },
            },
            delete: {
                tags: ['Admin — Categories'],
                summary: 'Удалить категорию',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Удалено' }, 404: { description: 'Не найдено' } },
            },
        },

        // ═══════════════════════════════════════
        // ADMIN — ITEMS
        // ═══════════════════════════════════════
        '/api/admin/items': {
            get: {
                tags: ['Admin — Items'],
                summary: 'Все блюда (с фильтрами)',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'category_id', in: 'query', schema: { type: 'integer' } },
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['available', 'coming_soon', 'out_of_stock', 'hidden'] } },
                ],
                responses: { 200: { description: 'Список блюд' } },
            },
            post: {
                tags: ['Admin — Items'],
                summary: 'Создать блюдо (с изображением)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['name_ru', 'price', 'category_id'],
                                properties: {
                                    name_ru: { type: 'string', example: 'Маргарита' },
                                    name_kg: { type: 'string' },
                                    description_ru: { type: 'string' },
                                    description_kg: { type: 'string' },
                                    ingredients: { type: 'string', example: 'томаты, моцарелла, базилик' },
                                    price: { type: 'integer', example: 450 },
                                    category_id: { type: 'integer', example: 1 },
                                    status: { type: 'string', enum: ['available', 'coming_soon', 'out_of_stock', 'hidden'] },
                                    is_popular: { type: 'boolean' },
                                    sort_order: { type: 'integer' },
                                    image: { type: 'string', format: 'binary', description: 'JPEG/PNG/WebP, до 5MB' },
                                },
                            },
                        },
                    },
                },
                responses: { 201: { description: 'Создано' } },
            },
        },
        '/api/admin/items/{id}': {
            put: {
                tags: ['Admin — Items'],
                summary: 'Обновить блюдо',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: {
                    name_ru: { type: 'string' }, price: { type: 'integer' }, status: { type: 'string' }, image: { type: 'string', format: 'binary' },
                }}}}},
                responses: { 200: { description: 'Обновлено' } },
            },
            delete: {
                tags: ['Admin — Items'],
                summary: 'Удалить блюдо',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Удалено' } },
            },
        },

        // ═══════════════════════════════════════
        // ADMIN — ORDERS
        // ═══════════════════════════════════════
        '/api/admin/orders': {
            get: {
                tags: ['Admin — Orders'],
                summary: 'Список заказов',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'status', in: 'query', schema: { type: 'string' }, description: 'paid, preparing, ready, delivering, delivered, cancelled' },
                    { name: 'type', in: 'query', schema: { type: 'string', enum: ['delivery', 'pickup'] } },
                    { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-03-01' },
                    { name: 'date_to', in: 'query', schema: { type: 'string', format: 'date' } },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                ],
                responses: { 200: { description: 'Список заказов с пагинацией' } },
            },
        },
        '/api/admin/orders/{id}': {
            get: {
                tags: ['Admin — Orders'],
                summary: 'Детали заказа (с историей статусов)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Полные данные заказа' } },
            },
        },
        '/api/admin/orders/{id}/status': {
            patch: {
                tags: ['Admin — Orders'],
                summary: 'Сменить статус заказа',
                description: 'Меняет статус, записывает в историю, отправляет push в Telegram',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: {
                        type: 'object',
                        required: ['status'],
                        properties: {
                            status: { type: 'string', enum: ['paid', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'], example: 'preparing' },
                        },
                    }}},
                },
                responses: { 200: { description: 'Статус изменён' } },
            },
        },

        // ═══════════════════════════════════════
        // ADMIN — OFFICES
        // ═══════════════════════════════════════
        '/api/admin/offices': {
            get: { tags: ['Admin — Offices'], summary: 'Все офисы', security: [{ BearerAuth: [] }], responses: { 200: { description: 'OK' } } },
            post: {
                tags: ['Admin — Offices'],
                summary: 'Создать офис',
                security: [{ BearerAuth: [] }],
                requestBody: { content: { 'application/json': { schema: {
                    type: 'object',
                    required: ['name', 'address'],
                    properties: {
                        name: { type: 'string', example: 'Филиал Центр' },
                        address: { type: 'string', example: 'ул. Токтогула, 89' },
                        phone: { type: 'string' },
                        working_hours: { type: 'string', example: '10:00-22:00' },
                        is_active: { type: 'boolean' },
                    },
                }}}},
                responses: { 201: { description: 'Создано' } },
            },
        },
        '/api/admin/offices/{id}': {
            put: { tags: ['Admin — Offices'], summary: 'Обновить', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } },
            delete: { tags: ['Admin — Offices'], summary: 'Удалить', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } },
        },

        // ═══════════════════════════════════════
        // ADMIN — PROMOS
        // ═══════════════════════════════════════
        '/api/admin/promos': {
            get: { tags: ['Admin — Promos'], summary: 'Все промокоды', security: [{ BearerAuth: [] }], responses: { 200: { description: 'OK' } } },
            post: {
                tags: ['Admin — Promos'],
                summary: 'Создать промокод',
                security: [{ BearerAuth: [] }],
                requestBody: { content: { 'application/json': { schema: {
                    type: 'object',
                    required: ['code', 'type', 'value'],
                    properties: {
                        code: { type: 'string', example: 'SUMMER20' },
                        type: { type: 'string', enum: ['percent', 'fixed'] },
                        value: { type: 'integer', example: 20 },
                        min_order: { type: 'integer', example: 500 },
                        max_uses: { type: 'integer', example: 100 },
                        valid_from: { type: 'string', format: 'date-time' },
                        valid_to: { type: 'string', format: 'date-time' },
                        is_active: { type: 'boolean' },
                    },
                }}}},
                responses: { 201: { description: 'Создано' } },
            },
        },
        '/api/admin/promos/{id}': {
            put: { tags: ['Admin — Promos'], summary: 'Обновить', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } },
            delete: { tags: ['Admin — Promos'], summary: 'Удалить', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } },
        },

        // ═══════════════════════════════════════
        // ADMIN — PRINT
        // ═══════════════════════════════════════
        '/api/admin/orders/{id}/receipt/kitchen': {
            get: {
                tags: ['Admin — Print'],
                summary: 'Кухонный чек (HTML)',
                description: 'Возвращает HTML-страницу кухонного чека. Можно открыть в browser и нажать Ctrl+P.',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'HTML кухонного чека', content: { 'text/html': {} } } },
            },
        },
        '/api/admin/orders/{id}/receipt/client': {
            get: {
                tags: ['Admin — Print'],
                summary: 'Клиентский чек (HTML)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'HTML клиентского чека', content: { 'text/html': {} } } },
            },
        },
        '/api/admin/orders/{id}/receipt/pdf': {
            get: {
                tags: ['Admin — Print'],
                summary: 'Клиентский чек (PDF)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'PDF файл', content: { 'application/pdf': {} } } },
            },
        },
        '/api/admin/orders/{id}/print/kitchen': {
            post: {
                tags: ['Admin — Print'],
                summary: 'Печать кухонного чека на термопринтер',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Отправлено на принтер' }, 500: { description: 'Принтер недоступен' } },
            },
        },
        '/api/admin/orders/{id}/print/client': {
            post: {
                tags: ['Admin — Print'],
                summary: 'Печать клиентского чека на термопринтер',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Отправлено на принтер' } },
            },
        },
        '/api/admin/printer/test': {
            post: {
                tags: ['Admin — Print'],
                summary: 'Тестовая печать',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Тестовый чек отправлен' } },
            },
        },
        '/api/admin/settings/printer': {
            get: {
                tags: ['Admin — Print'],
                summary: 'Получить настройки принтера',
                security: [{ BearerAuth: [] }],
                responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/PrinterSettings' } } } } },
            },
            put: {
                tags: ['Admin — Print'],
                summary: 'Сохранить настройки принтера',
                security: [{ BearerAuth: [] }],
                requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/PrinterSettings' } } } },
                responses: { 200: { description: 'Сохранено' } },
            },
        },

        // ═══════════════════════════════════════
        // ADMIN — STATS
        // ═══════════════════════════════════════
        '/api/admin/stats': {
            get: {
                tags: ['Admin — Stats'],
                summary: 'Dashboard статистика',
                description: 'Заказы за сегодня/неделю/месяц, средний чек, топ-10 блюд, графики',
                security: [{ BearerAuth: [] }],
                responses: { 200: { content: { 'application/json': { schema: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: { $ref: '#/components/schemas/Stats' },
                    },
                }}}}},
            },
        },

        // ═══════════════════════════════════════
        // HEALTH
        // ═══════════════════════════════════════
        '/api/health': {
            get: {
                summary: 'Health check',
                responses: { 200: { description: 'OK' } },
            },
        },
    },
};

module.exports = swaggerSpec;
