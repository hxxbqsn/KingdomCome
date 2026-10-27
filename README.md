# Kingdom Come

面向游戏存档与架空设定的家族档案网站。以世界线组织家族、人物与关系，结合可交互家谱、人物传记和馆藏图像，提供深色档案馆风格的浏览与编辑体验。

## 功能

### 世界线与家族

- 创建、编辑和删除世界线，通过顶部导航切换当前世界线。
- 按世界线管理家谱，每份家谱拥有名称、简介和封面。
- 上传家族封面，或从九张内置馆藏图像中选择。
- 删除家族或人物时同步清理相关人物关系和资料引用；删除操作需要确认。

### 首页

- 手稿与宫廷织物组成的分层拼贴，各层提供不同幅度的悬停动效。
- 从全部世界线中搜索、筛选并选择一份精选家谱，所有世界线的首页共用这份选择。
- 精选家谱预览与右侧人物名册联动；人物名册展示所选家族的肖像。
- 打开精选家谱或人物档案时，自动切换到所属世界线。

### 家谱画布

- 六边形人物肖像、姓名、生卒年和 SVG 曲线关系线。
- 鼠标拖动平移、滚轮缩放、触屏拖动、双指缩放及适合画布。
- 搜索定位人物，选中后突出相关人物与连线、弱化无关人物。
- 桌面右侧详情面板与手机底部详情，支持编辑和进入完整人物档案。
- 支持父母、配偶、子女及情人关系，以及同一世界线内的跨家族关系。

### 人物与档案

- 人物名册提供肖像网格、列表、姓名搜索、家族筛选和姓名或出生年代排序。
- 人物编辑器采用左侧肖像布局，分为身份信息、人物关系和生平记录。
- 通过姓名搜索与家族筛选选择关系对象，已选人物可直接移除。
- 配偶与情人关系双向更新；父母与子女从同一份关系记录推导，并检查亲属循环和角色冲突。
- 人物档案展示肖像、基本资料、生平、备注、亲属和关联资料，支持亲属跳转和资料详情查看。

### 肖像裁剪

- 上传后使用并列裁剪界面调整六边形构图。
- 支持鼠标拖动、滚轮和滑块缩放，以及手机单指拖动、双指缩放。
- 应用裁剪时同时保存裁剪图和最长边不超过 1400 px 的原图副本，便于重新裁剪。
- 家谱肖像边框可在“复线”和“细线”之间切换。

### 显示偏好

- 四种强调色：苔石绿、冷银灰、暗酒红、旧铜金。
- 背景纹理、页面动效、生卒年显示，以及舒展或紧凑的家谱间距。
- 适配电脑、平板和手机，并尊重系统的减少动态效果设置。

## 本地运行

环境要求：Node.js 20.19+，或 22.12+，以及 npm。

在项目根目录执行：

```sh
npm ci
npm run dev
```

访问终端显示的地址。开发服务默认监听 `127.0.0.1`，端口占用时以终端输出为准。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发预览 |
| `npm run build` | TypeScript 检查并生成 `dist/` |
| `npm run preview` | 预览生产构建，先执行 build |
| `npm run test:accounts` | 执行本地账户、表单、接口与数据库权限测试 |

## 使用流程

1. 在设置中创建世界线，填写游戏、存档或设定名称。
2. 在“家谱”页面创建家族，选择或上传封面。
3. 添加人物，填写资料并选择父母、配偶、情人和子女。
4. 在家谱画布浏览关系，从节点进入详情或完整人物档案。
5. 在首页“精选家谱”旁点击“更换”，选择用于首页展示的家族。
6. 在设置中调整画面偏好，管理保存、备份和历史版本。

## 保存与账户

| 运行方式 | 保存方式与操作 |
| --- | --- |
| 本地模式 | 直接编辑，资料和偏好自动保存在当前浏览器，通过 JSON 导入、导出备份 |
| 账户模式 | 配置 Supabase 后，以用户名和密码登录，自动保存到本机账户缓存并同步至云端 |

注册使用用户名、密码和确认密码。用户名不区分大小写，支持 3–24 位字母、数字、下划线和短横线；密码至少 6 位。注册成功后自动登录，确认密码只在表单中核对。

账户模式下，每个账户拥有独立的本机缓存与云端档案。保存状态显示本机保存、等待同步、同步中或已同步；版本冲突会保留本机内容并提示处理。云端覆盖保存时保留此前版本，可查看和恢复最近 20 份历史快照。

设置中的“迁移本机资料”可将当前浏览器原有档案迁入登录账户；“备份与恢复”提供完整 JSON 导入、导出。导入或迁移会确认替换当前档案，备份包含世界线、家族、人物、关系、图片、首页精选与显示偏好。

浏览器资料按网址和端口区分。迁移已有资料时，从原先使用的网址导出，再在目标网址登录后导入。

账户与云端服务的配置步骤见 [Supabase 配置说明](supabase/README.md)。

## 页面

| 地址 | 页面 |
| --- | --- |
| `/` | 家族档案首页 |
| `/trees` | 家族谱系列表 |
| `/trees/:id` | 家谱画布与人物详情 |
| `/people` | 人物名册 |
| `/people?tree=:id` | 按家族筛选的人物名册 |
| `/people/:id` | 完整人物档案 |
| `/settings` | 世界线、显示偏好、账户、备份与版本管理 |
| `/login` | 用户名登录 |
| `/register` | 创建账户 |

## 部署

使用 GitHub 保存代码，通过 Vercel 构建和发布前端，账户模式连接 Supabase。

在 Vercel 导入仓库，使用以下配置：

| 项目设置 | 值 |
| --- | --- |
| Framework Preset | `Vite` |
| Root Directory | 项目根目录 |
| Build Command | `npm run build` |
| Output Directory | `dist` |

账户模式需要设置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`；本地开发将它们填写在根目录 `.env.local` 中，部署时添加到 Vercel 环境变量。环境变量变更后重新构建部署。

`vercel.json` 提供单页应用路由回退，支持直接访问和刷新人物、家谱等子页面。前端代码推送到关联分支后由 Vercel 自动部署；认证函数通过 Supabase 单独发布。

## 代码结构

```text
src/
  App.tsx                 路由、导航、页面与编辑器
  Home.tsx                首页与家谱、人物联动
  FeaturedTreePicker.tsx  全局精选家谱选择
  TreeCanvas.tsx          家谱布局、曲线、平移缩放与人物节点
  PortraitCropper.tsx     肖像上传后的构图与裁剪
  PortraitImage.tsx       肖像图像组件
  data.ts                 数据类型、示例记录与关系辅助函数
  store.tsx               共享状态、导入校验与关系更新
  persistence.ts          本地保存、账户缓存、同步与冲突处理
  auth.tsx                登录会话、注册与退出
  Account.tsx             登录注册表单、账户设置与历史版本
  supabase.ts             云端客户端与用户名规范
  main.tsx                应用入口与账户、数据上下文
  styles.css              基础布局与组件
  medieval.css            档案馆视觉与响应式样式
  refinements.css         肖像边框、编辑器与页面细节
  home.css                首页拼贴与馆藏对页布局
  account.css             登录注册、账户与保存状态样式
supabase/
  functions/              用户名登录和注册服务端函数
  migrations/             数据表、访问权限与版本保存接口
  README.md               账户服务配置与发布说明
tests/accounts.test.mjs    本地账户与数据权限测试
public/assets/            馆藏图片与肖像资源
.env.example              前端环境变量模板
vercel.json               部署路由配置
```

世界线、家谱、人物和资料均通过统一数据模型引用。人物以独立 ID 保存关系，子女由父母记录推导；页面、详情面板和家谱画布共享同一份状态。

## 设计调整工具

启动开发服务后，可访问以下工具。通过页面中的复制或导出功能分享设计参数。

| 地址 | 用途 |
| --- | --- |
| `/design-preview.html` | 人物编辑器、页面密度、描边与拼贴比较 |
| `/profile-layout-preview.html` | 人物档案的肖像高度、信息间距与文字排版 |
| `/portrait-crop-preview.html` | 肖像边框和裁剪操作方案 |
| `/home-layout-editor.html` | 首页图层位置、大小、文字参数与响应式尺寸调整 |
| `/home-sections-preview.html` | 首页家谱区和人物区排版比较 |
| `/title-size-preview.html` | 三个页面主标题的统一字号调整 |

预览工具使用独立的调整状态，正式页面的样式由 `src/` 中的组件与样式文件管理。

## 示例与图片来源

内置“示例世界线”包含瓦伦、瑞文两个虚构家族和九位人物，用于展示婚配、父母子女、情人及跨家族关系。人物姓名、年代和故事属于示例设定，肖像与手稿使用真实历史馆藏图像。

以下图片均来自[大都会艺术博物馆开放获取馆藏](https://www.metmuseum.org/about-the-met/policies-and-documents/open-access)，各条馆藏页面标注为公有领域。网站将其下载到 `public/assets/`，因此页面可离线显示。

| 本地文件 | 馆藏记录 |
| --- | --- |
| `portrait-art-1.jpg` | [男子肖像，1491 年](https://www.metmuseum.org/art/collection/search/436480) |
| `portrait-art-2.jpg` | [女子肖像，约 1470–1480 年](https://www.metmuseum.org/art/collection/search/459071) |
| `portrait-art-3.jpg` | [青年男子肖像，约 1470 年](https://www.metmuseum.org/art/collection/search/435581) |
| `portrait-art-4.jpg` | [女子肖像，约 1494 年](https://www.metmuseum.org/art/collection/search/459038) |
| `portrait-art-5.jpg` | [男子肖像，约 1494 年](https://www.metmuseum.org/art/collection/search/459037) |
| `portrait-art-6.jpg` | [青年女子肖像](https://www.metmuseum.org/art/collection/search/437324) |
| `portrait-art-7.jpg` | [青年男子肖像，1480 年代](https://www.metmuseum.org/art/collection/search/436769) |
| `portrait-art-8.jpg` | [女子肖像，16 世纪中期](https://www.metmuseum.org/art/collection/search/436739) |
| `portrait-art-9.jpg` | [青年男子肖像，约 1470 年](https://www.metmuseum.org/art/collection/search/435664) |
| `archive-court.jpg` | [宫廷场景织物，约 1510–1525 年](https://www.metmuseum.org/art/collection/search/468049) |
| `archive-marriage.jpg` | [婚礼场景手稿页](https://www.metmuseum.org/art/collection/search/468476) |
| `archive-manuscript.jpg` | [祈祷书手稿页，1390–1400 年](https://www.metmuseum.org/art/collection/search/32837) |
| `archive-family.jpg` | [丁特维尔家族寓意画，1537 年](https://www.metmuseum.org/art/collection/search/437217) |
| `archive-courtyard.jpg` | [意大利庭院素描，1643 年](https://www.metmuseum.org/art/collection/search/820770) |
| `archive-letter.jpg` | [约 1300 年法国《圣经》手稿页](https://www.metmuseum.org/art/collection/search/470122) |
| `cover-arthur.jpg` | [亚瑟王织物，约 1400–1410 年](https://www.metmuseum.org/art/collection/search/467528) |
| `cover-rose-garden.jpg` | [玫瑰园里的宫廷人物，约 1440–1450 年](https://www.metmuseum.org/art/collection/search/463187) |
| `cover-charlemagne.jpg` | [查理曼故事织物，约 1500–1510 年](https://www.metmuseum.org/art/collection/search/467787) |
| `home-forest.jpg` | [《独角兽净化泉水》织物，1495–1505 年](https://www.metmuseum.org/art/collection/search/467638) |
| `home-codex.jpg` | [《上帝之城》西班牙译本，1446–1482 年](https://www.metmuseum.org/art/collection/search/469825) |
| `home-heraldry.jpg` | [丢勒《骷髅纹章》，1503 年](https://www.metmuseum.org/art/collection/search/336220) |

字体通过 Google Fonts 加载，使用衬线标题与无衬线界面文字，并提供系统字体回退。
