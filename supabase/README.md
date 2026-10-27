# 账户与云端保存

Kingdom Come 使用 Supabase Auth 管理账户，使用 PostgreSQL 保存账户档案和历史版本，通过 Edge Functions 提供用户名注册与登录。

## 账户流程

1. 用户在 `/register` 填写用户名、密码和确认密码。
2. 表单核对确认密码，向 `username-register` 发送用户名和密码。
3. 服务端验证输入、检查请求次数并创建账户。
4. 客户端调用 `username-login` 自动登录，由 Supabase SDK 保存会话。
5. 数据上下文按账户 ID 加载独立缓存与云端档案。

用户名统一去除首尾空格并转为小写，支持 3–24 位字母、数字、下划线和短横线。注册密码至少 6 位。

服务端将用户名映射为 `用户名@accounts.kingdomcome.invalid`，作为 Supabase Auth 的内部身份地址，并在创建账户时设置已确认。用户通过用户名和密码操作，密码由 Supabase Auth 负责存储和验证。身份服务故障、密码错误、重复用户名和请求超限分别返回对应结果。

## 目录

| 文件 | 作用 |
| --- | --- |
| `migrations/202610250001_accounts.sql` | 建立数据表、账户权限、请求计数与事务保存接口 |
| `functions/username-register/index.ts` | 创建用户名账户 |
| `functions/username-login/index.ts` | 验证密码并返回会话令牌 |
| `config.toml` | 登录、注册函数的访问配置 |
| `../.env.example` | 前端连接配置模板 |

## 配置 Supabase

### 1. 创建项目

在 [Supabase Dashboard](https://supabase.com/dashboard) 创建项目，保存数据库密码，选择适合使用地区的节点。

在 Authentication 的认证设置中启用邮箱与密码认证，将密码最低长度设为 6，并关闭平台直接公开注册和匿名登录。网站通过 `username-register` 使用管理员接口创建账户。

### 2. 初始化数据库

在项目的 SQL Editor 新建查询，粘贴 `migrations/202610250001_accounts.sql` 的完整内容并执行。

该脚本用于新项目初始化，执行一次即可。它创建：

| 数据对象 | 作用 |
| --- | --- |
| `archives` | 每个账户的当前档案、版本号和更新时间 |
| `archive_versions` | 账户历史快照 |
| `login_attempts` | 登录与注册的服务端请求计数 |
| `save_archive` | 校验账户与版本号，原子保存整份档案 |
| `consume_login_attempt` | 消耗请求额度，仅服务端角色可调用 |

### 3. 发布认证函数

在 Edge Functions 中选择 **Deploy a new function → Via Editor**，按名称分别创建函数，将对应 `index.ts` 的完整内容替换模板后部署：

- `username-login`
- `username-register`

两个函数都设置 `verify_jwt = false`，在 Dashboard 中关闭对应的 Verify JWT 选项。函数处理取得会话之前的请求，并在代码中校验用户名、密码和请求次数。

函数读取 Supabase 注入的服务端环境变量：

| 变量 | 用途 |
| --- | --- |
| `SUPABASE_URL` | 项目 API 地址 |
| `SUPABASE_ANON_KEY` | 调用密码登录接口 |
| `SUPABASE_SERVICE_ROLE_KEY` | 创建账户与更新请求计数 |

管理员密钥仅在 Edge Functions 中使用。前端配置使用下一步的 Publishable key。

### 4. 配置前端

从项目的 Connect 或 Settings → API Keys 获取 Project URL 和 Publishable key。

将根目录 `.env.example` 复制为 `.env.local`，填写：

```dotenv
VITE_SUPABASE_URL=https://你的项目标识.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=你的publishable-key
```

本地修改后重启开发服务；在 Vercel 部署时，将相同名称的变量添加到项目环境变量，并重新部署。

`.env.local` 由 Git 忽略规则排除。前端通过 `src/supabase.ts` 读取这两个变量，并启用账户运行方式。

## 数据保存

档案使用统一的版本 3 数据结构，包含世界线、家族、人物、资料、首页精选和显示偏好。

- 本地运行使用浏览器存储保存档案。
- 账户模式以 `kingdom-come-account:<账户ID>` 保存独立本机缓存。
- 编辑后先写入本机缓存，经过短暂合并后将整份档案上传至 `save_archive`。
- 重新联网或页面恢复可见时会再次检查同步。
- 待上传修改保留在本机，页面使用“本机已保存，等待同步...”等状态反馈。
- 云端覆盖保存时将此前版本转为快照，保留最近 20 份；设置中可查看并恢复。
- 图片随档案数据一起保存，肖像同时包含裁剪结果和用于重新构图的原图副本。

保存请求携带已知版本号。数据库在事务中比较版本：匹配时写入并递增，不匹配时保留当前内容并返回冲突。界面提供备份与读取云端版本的操作。

退出登录清除当前账户的本机缓存；存在待同步资料时先提示确认。设置中的“迁移本机资料”可将原浏览器档案迁入当前账户，JSON 导入、导出用于完整备份与恢复。

## 访问权限

- `archives` 与 `archive_versions` 启用行级安全策略，登录账户按 `auth.uid()` 读取自己的记录。
- 保存通过 `save_archive` 执行，账户身份取自当前会话。
- 请求计数表及其函数由服务端角色访问。
- 密码登录返回 Access Token 和 Refresh Token，会话交由 Supabase SDK 管理。
- 已连接服务的访客可浏览示例，资料修改通过登录入口进入账户。

同一用户名每 15 分钟最多 10 次登录尝试。注册按用户名限制，并设置整站每 15 分钟最多 10 次注册请求的额度。

## 检查与发布

在项目根目录执行：

```sh
npm run test:accounts
npm run build
```

测试使用 PGlite 在本地执行 PostgreSQL 迁移，验证账户隔离、匿名访问权限、版本比较、历史快照保留与请求限制；认证接口使用模拟服务验证成功和失败路径，表单测试覆盖密码校验、确认密码和重复提交。

连接实际项目后，按以下流程验收：

1. 注册账户并确认自动登录，刷新后会话持续有效。
2. 创建家族或人物，等待保存状态变为“已同步”。
3. 在另一设备登录同一账户，读取并修改这份档案。
4. 登录第二个账户，确认其资料独立保存。
5. 查看历史快照，恢复后确认新版本完成同步。
6. 检查备份导出、导入和本机资料迁移。

前端推送到 Vercel 关联的 Git 分支后触发构建；认证函数的更新通过 Supabase 重新部署。

## 参考

- [Supabase 认证设置](https://supabase.com/docs/guides/auth/general-configuration)
- [Dashboard 发布 Edge Functions](https://supabase.com/docs/guides/functions/quickstart-dashboard)
- [函数配置](https://supabase.com/docs/guides/functions/function-configuration)
- [函数环境变量](https://supabase.com/docs/guides/functions/secrets)
