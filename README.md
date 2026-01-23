# Blog API 接口文档

## 基础信息

- **Base URL**: `http://localhost:8000`
- **数据格式**: 
- **认证方式**: Bearer TokenJSON

## 统一响应格式

### 成功响应
```json
{
  "success": true,
  "message": "操作成功",
  "token": "...",           // 仅登录接口
  "expiresIn": 86400000,    // 仅登录接口（毫秒）
  "article": { ... },       // 单个文章
  "talk": { ... },          // 单个说说
  "data": [...],            // 列表数据
  "allTags": [...],         // 所有标签（说说列表）
  "page": 1,
  "pageSize": 10,
  "total": 100,
  "totalPages": 10
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误信息",
  "details": [...],        // 详细错误信息（可选）
  "needTurnstile": true     // 是否需要人机验证
}
```

---

## 认证接口

### POST /api/system/login
管理员登录/注册（首次登录自动注册）

**说明**:
- 管理员信息存储在 `configs` 表中,key 为 `admin`
- 仅支持单人个管理员用户
- 每次登录都会创建一个新的 token，支持多 token 共存
- Token 信息存储在 `tokens` 表中

**请求头**:
- `Content-Type: application/json`

**请求体**:
```json
{
  "username": "admin",
  "password": "password123",
  "turnstileToken": "..."  // 可选，人机验证令牌
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "登录成功",
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
  "expiresIn": 86400000
}
```

**错误响应**:
- `401` - 用户名或密码错误
- `400` - 需要人机验证

---

### POST /api/system/updateAccount
修改用户名或密码（需认证）

**说明**:
- 修改用户名或密码都需要提供当前密码验证
- username 和 password 至少提供一个

**请求头**:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "username": "newadmin",        // 可选，修改用户名
  "password": "newpassword",   // 可选，修改密码
  "currentPassword": "oldpass"    // 必填，当前密码
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "账号信息更新成功"
}
```

**错误响应**:
- `400` - 未提供当前密码
- `401` - 当前密码错误
- `404` - 账号不存在

---

## Token 管理接口

### GET /api/tokens/list
获取所有 token 列表（需认证）

**请求头**:
- `Authorization: Bearer <token>`

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "name": "Login",
      "description": "登录时自动创建",
      "expiresAt": "2026-01-24T10:30:00.000Z",
      "createdAt": "2026-01-23T10:30:00.000Z",
      "lastUsedAt": "2026-01-23T11:00:00.000Z",
      "isActive": true,
      "tokenPreview": "a1b2c3d4..."
    }
  ]
}
```

---

### POST /api/tokens/create
创建新 token（需认证）

**请求头**:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "name": "Token Name",
  "description": "这是 Token 的说明",
  "expiresIn": 604800000  // 可选，过期时间（毫秒），默认 86400000（24小时）
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Token 创建成功",
  "data": {
    "id": 2,
    "name": "开发环境 Token",
    "description": "用于本地开发测试",
    "token": "f5e6d7c8b9a0...",
    "expiresAt": "2026-01-30T10:30:00.000Z",
    "createdAt": "2026-01-23T10:30:00.000Z",
    "expiresIn": 604800000
  }
}
```

**错误响应**:
- `400` - 请求参数验证失败

---

### DELETE /api/tokens/revoke
删除 token（需认证）

**请求头**:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "id": 2
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Token 'Token Name' 已删除"
}
```

**错误响应**:
- `404` - Token 不存在

---

## 文章接口

### GET /api/article/list
获取文章列表

**查询参数**:
- `posts` - 可选，`all` 表示返回所有文章（包括未发布），默认只返回已发布
- `fields` - 可选，指定返回字段，如 `slug,title,date`
- `page` - 可选，页码（需与 pageSize 同时使用）
- `pageSize` - 可选，每页数量（需与 page 同时使用）
- `sort` - 可选，排序方式，`asc` 或 `desc`，默认 `desc`

**说明**:
- 当不传 `page` 和 `pageSize` 时，返回所有匹配的文章（不分页）
- 当传入 `page` 和 `pageSize` 时，返回分页数据
- `fields` 参数指定的字段必须是以下之一：`slug`, `title`, `description`, `tags`, `published`, `date`

**错误响应**:
- `400` - 排序参数无效（只能为 asc 或 desc）
- `400` - 分页参数不完整

**示例请求**:
```
GET /api/article/list?posts=all&fields=slug,title,date
GET /api/article/list?page=1&pageSize=10
GET /api/article/list?sort=asc
```

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": [
    {
      "slug": "my-first-post",
      "title": "我的第一篇文章",
      "description": "这是文章摘要",
      "tags": ["技术", "Vue"],
      "published": true,
      "date": "2024-01-01"
    }
  ]
}
```

---

### GET /api/article/get
获取单篇文章内容

**查询参数**:
- `slug` - 必填，文章标识符
- `type` - 可选，`markdown` 或 `html`，默认 `markdown`

**示例请求**:
```
GET /api/article/get?slug=my-first-post&type=html
```

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "frontmatter": {
    "slug": "my-first-post",
    "title": "我的第一篇文章",
    "description": "这是文章摘要",
    "tags": ["技术", "Vue"],
    "published": true,
    "date": "2024-01-01"
  },
  "content": "<h1>文章内容</h1><p>...</p>"
}
```

---

### GET /api/article/all
获取所有文章（包含内容，需认证）

**查询参数**:
- `page` - 可选，页码（需与 pageSize 同时使用）
- `pageSize` - 可选，每页数量（需与 page 同时使用）
- `sort` - 可选，排序方式，`asc` 或 `desc`，默认 `desc`

**说明**:
- 当不传 `page` 和 `pageSize` 时，返回所有文章（不分页）
- 当传入 `page` 和 `pageSize` 时，返回分页数据

**错误响应**:
- `400` - 排序参数无效（只能为 asc 或 desc）
- `400` - 分页参数不完整

**请求头**:
- `Authorization: Bearer <token>`

**示例请求**:
```
GET /api/article/all?page=1&pageSize=10
GET /api/article/all?sort=asc
```

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": [
    {
      "slug": "my-first-post",
      "title": "我的第一篇文章",
      "description": "这是文章摘要",
      "tags": ["技术", "Vue"],
      "content": "# 文章内容\n...",
      "published": true,
      "date": "2024-01-01"
    }
  ],
  "allTags": ["技术", "Vue", "生活"],
  "page": 1,
  "pageSize": 10,
  "total": 50,
  "totalPages": 5
}
```

---

### POST /api/article/add
添加文章（需认证）

**请求头**:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "slug": "my-new-post",
  "title": "新文章标题",
  "content": "# 文章内容\n...",
  "description": "文章摘要",
  "tags": ["技术", "Vue"],
  "date": "2024-01-01",
  "published": true,
  "turnstileToken": "..."  // 可选
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "文章添加成功",
  "article": {
    "id": 1,
    "slug": "my-new-post",
    "title": "新文章标题",
    "content": "# 文章内容\n...",
    "description": "文章摘要",
    "tags": ["技术", "Vue"],
    "date": "2024-01-01",
    "published": true,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**错误响应**:
- `401` - 未认证或 token 过期
- `409` - slug 已存在

---

### PUT /api/article/edit
更新文章（需认证）

**请求头**:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "slug": "my-first-post",
  "title": "更新的标题",
  "content": "更新的内容",
  "description": "更新的摘要",
  "tags": ["技术"],
  "date": "2024-01-02",
  "published": false,
  "turnstileToken": "..."
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "文章更新成功",
  "article": {
    "id": 1,
    "slug": "my-first-post",
    "title": "更新的标题",
    "content": "更新的内容",
    ...
  }
}
```

---

### PUT /api/article/edit-slug
修改文章 slug（需认证）

**请求头**:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "oldSlug": "old-slug",
  "newSlug": "new-slug",
  "turnstileToken": "..."
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "slug 更新成功",
  "article": {
    "id": 1,
    "slug": "new-slug",
    ...
  }
}
```

---

### DELETE /api/article/delete
删除文章（需认证）

**请求头**:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "slug": "my-first-post",
  "turnstileToken": "..."
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "文章 'my-first-post' 删除成功"
}
```

---

## 说说接口

### GET /api/talks/get
获取说说列表

**查询参数**:
- `page` - 可选，页码（需与 pageSize 同时使用）
- `pageSize` - 可选，每页数量（需与 page 同时使用）
- `tag` - 可选，按标签筛选
- `sort` - 可选，排序方式，`asc` 或 `desc`，默认 `desc`

**说明**:
- 当不传 `page` 和 `pageSize` 时，返回所有说说（不分页）
- 当传入 `page` 和 `pageSize` 时，返回分页数据

**错误响应**:
- `400` - 排序参数无效（只能为 asc 或 desc）

**示例请求**:
```
GET /api/talks/get?page=1&pageSize=20&tag=技术&sort=desc
GET /api/talks/get?sort=asc
```

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "content": "今天天气不错",
      "location": "北京",
      "links": [
        {
          "text": "Google",
          "url": "https://google.com"
        }
      ],
      "imgs": ["https://example.com/img.jpg"],
      "tags": ["生活"],
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "allTags": ["生活", "技术", "Vue"],
  "page": 1,
  "pageSize": 20,
  "total": 100,
  "totalPages": 5
}
```

---

### POST /api/talks/add
添加说说（需认证）

**请求头**:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "content": "今天天气不错",
  "location": "北京",
  "links": [
    {
      "text": "Google",
      "url": "https://google.com"
    }
  ],
  "imgs": ["https://example.com/img.jpg"],
  "tags": ["生活"],
  "turnstileToken": "..."
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "说说添加成功",
  "talk": {
    "id": 1,
    "content": "今天天气不错",
    "location": "北京",
    ...
  }
}
```

---

### PUT /api/talks/edit
更新说说（需认证）

**请求头**:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "id": 1,
  "content": "更新后的内容",
  "location": "上海",
  "links": [...],
  "imgs": [...],
  "tags": ["技术"],
  "turnstileToken": "..."
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "说说更新成功",
  "talk": {
    "id": 1,
    "content": "更新后的内容",
    ...
  }
}
```

---

### DELETE /api/talks/delete
删除说说（需认证）

**请求头**:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "id": 1,
  "turnstileToken": "..."
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "说说 '1' 删除成功"
}
```

---

## 人机验证

部分接口支持 Cloudflare Turnstile 人机验证。当后端返回 `needTurnstile: true` 时，前端需要：

1. 弹出 Turnstile 验证组件
2. 获取验证 token
3. 将 token 通过以下方式之一传回后端：
   - 请求体中的 `turnstileToken` 字段
   - 请求头中的 `x-turnstile-token` 字段

**触发验证的场景**:
- 多次登录失败
- 可疑操作行为

---

## 错误码说明

| HTTP 状态码 | 说明 |
|------------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或认证失败 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 409 | 数据冲突（如重复的 slug） |
| 500 | 服务器内部错误 |
| 503 | 服务不可用 |

---

## 数据字段说明

### Article (文章)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 文章 ID |
| slug | string | 文章唯一标识符 |
| title | string | 文章标题 |
| content | string | 文章内容（Markdown） |
| description | string | 文章摘要 |
| tags | string[] | 标签数组 |
| published | boolean | 是否已发布 |
| date | string | 发布日期 (YYYY-MM-DD) |
| created_at | string | 创建时间 |
| updated_at | string | 更新时间 |

### Talk (说说)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 说说 ID |
| content | string | 说说内容 |
| location | string \| null | 地点 |
| links | object[] | 链接数组 |
| imgs | string[] | 图片 URL 数组 |
| tags | string[] | 标签数组 |
| created_at | string | 创建时间 |

### Config (配置)
| 字段 | 类型 | 说明 |
|------|------|------|
| key | string | 配置键名 (主键) |
| value | JSONB | 配置值 (JSONB 格式) |
| description | string \| null | 配置描述 |
| updated_at | string | 更新时间 |

### Token (访问令牌)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 令牌 ID |
| token | string | 令牌值 |
| name | string \| null | 令牌名称 |
| description | string \| null | 令牌描述 |
| expires_at | string \| null | 过期时间 |
| created_at | string | 创建时间 |
| last_used_at | string \| null | 最后使用时间 |
| is_active | boolean | 是否激活 |

**预定义配置键**:
- `admin` - 管理员配置，包含 `username`、`password`，description: `管理员账号配置`
