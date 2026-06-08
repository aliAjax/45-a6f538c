# 会议督办系统

一个基于React、Express和SQLite的会议任务督办应用。前端由Vite启动，后端由Express提供`/api`接口，本地开发使用SQLite数据库。

## 快速启动

```bash
npm install
cp .env.example .env
npm run env:check
npm run dev
```

默认启动后：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:3001`
- 健康检查：`http://127.0.0.1:3001/api/health`
- 本地数据库：`data/meeting.db`

## 环境变量

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `API_PORT` | `3001` | 本地Express服务监听端口。 |
| `PORT` | `3001` | 兼容平台注入的端口；`API_PORT`优先级更高。 |
| `VITE_API_BASE` | `/api` | 前端请求API时使用的基础路径。 |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:${API_PORT}` | Vite开发代理目标。 |
| `DATABASE_PATH` | `data/meeting.db` | SQLite数据库路径，相对路径从项目根目录解析。 |
| `SEED_DATA` | 开发环境为`true` | 空库初始化示例会议、任务、模板和部门。 |
| `VERCEL_ENV` | 空 | Vercel运行环境，`production`和`preview`会触发安全检查。 |

## 启动脚本

```bash
npm run client:dev    # 只启动Vite前端
npm run server:dev    # 使用nodemon启动本地API
npm run server:start  # 直接启动本地API
npm run dev           # 同时启动前端和后端
npm run env:check     # 打印并校验运行时配置
npm run check         # TypeScript检查
npm run build         # 生产构建
npm test              # 自动化测试
```

## SQLite和部署防护

本地开发可以使用`data/meeting.db`和`SEED_DATA=true`。生产环境或Vercel预览环境不允许使用项目内`data/`目录作为SQLite路径，也不允许开启示例数据初始化。

以下配置会被运行时拒绝：

```bash
VERCEL=1 VERCEL_ENV=production DATABASE_PATH=data/meeting.db SEED_DATA=true npm run server:start
```

在生产或预览环境部署API时，必须将`DATABASE_PATH`设置为平台可持久化且不在项目`data/`目录下的位置，并设置：

```bash
SEED_DATA=false
```

Vercel的`api/index.ts`入口和本地`api/server.ts`入口都会执行同一套运行时检查，避免生产或预览环境误写本地`data/meeting.db`。
