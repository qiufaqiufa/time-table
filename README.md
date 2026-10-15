# 时间管理 H5 应用

纯前端时间管理应用，支持月日历、周视图、单日详情三个页面，数据存储在浏览器 localStorage，可部署到 GitHub Pages 手机访问。

## 功能

- **月日历**：背景色深浅表示当日事件数量（忙碌程度），红点表示待办数量
- **周视图**：课表式布局，纵向 24h 时间轴，横向周一至周日七列，支持循环课程
- **单日详情**：24h 时间轴 + 待办清单，支持新增/编辑/删除事件和待办
- **循环课程**：创建事件时可开启每周循环，自动渲染到截止日期前的每个指定星期
  - 新增时勾选"每周循环至截止日期"，选择截止日期即可
  - 循环色块与普通事件外观完全一致，无任何区分标记
  - 点击循环课程可单独修改/删除**某一周**，不影响其他周（生成覆盖事件）
  - 删除时可选择"仅删除本周"或"取消整个循环课程"
  - 月日历、周视图、单日详情三个页面均自动同步循环实例
- **数据同步**：三个页面共用 localStorage，修改后切换页面自动同步

## 本地预览

直接用浏览器打开 `month.html` 即可：

```bash
# macOS
open month.html

# Windows
start month.html

# Linux
xdg-open month.html
```

或使用任意本地服务器：

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve .
```

然后访问 `http://localhost:8000/month.html`

## 部署到 GitHub Pages

### 1. 创建 GitHub 仓库

1. 登录 [GitHub](https://github.com)
2. 点击右上角 **+** → **New repository**
3. 填写仓库名（如 `time-management`）
4. 选择 **Public**
5. 勾选 **Add a README file**（可选）
6. 点击 **Create repository**

### 2. 上传文件

**方法一：网页上传**

1. 进入新建的仓库页面
2. 点击 **Add file** → **Upload files**
3. 将 `time` 文件夹内的所有文件拖入上传区域：
   - `index.html`
   - `month.html` / `month.css` / `month.js`
   - `week.html` / `week.css` / `week.js`
   - `day.html` / `day.css` / `day.js`
4. 点击 **Commit changes**

**方法二：Git 命令行**

```bash
cd time
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/time-management.git
git push -u origin main
```

### 3. 开启 GitHub Pages

1. 进入仓库页面，点击 **Settings**
2. 左侧菜单找到 **Pages**
3. 在 **Source** 下选择 **Deploy from a branch**
4. **Branch** 选择 `main`，文件夹选择 `/ (root)`
5. 点击 **Save**

等待 1-2 分钟，页面会显示：

> Your site is live at https://你的用户名.github.io/time-management/

### 4. 手机访问

在手机浏览器打开上述链接即可。

**添加到主屏幕（可选）**：

- **iOS Safari**：点击分享按钮 → **添加到主屏幕**
- **Android Chrome**：点击菜单 → **添加到主屏幕**

## 文件结构

```
time/
── index.html          # 入口，自动跳转月视图
├── month.html/css/js   # 月日历页面
├── week.html/css/js    # 周视图页面
├── day.html/css/js     # 单日详情页面
└── README.md           # 本文件
```

## 数据存储

- `timeDiaryEvents`：时间段事件（id, date, start, end, title, note, color）
  - 循环课程的单周覆盖也存储在此，额外包含 `recurringId` 字段关联模板
  - 删除某一周的循环课程时，创建 `{ recurringId, date, deleted: true }` 记录
- `timeDiaryTodos`：待办事项（id, date, content, done）
- `timeDiaryRecurring`：循环课程模板（id, weekDay, startDate, endDate, start, end, title, note, color）

**循环课程渲染逻辑**：每次渲染时，根据循环模板动态计算当前周/当天的实例，如果该日期存在覆盖事件（`recurringId` 匹配）则使用覆盖数据，如果覆盖事件标记为 `deleted: true` 则跳过不渲染。

数据仅存储在浏览器本地，清除浏览器数据会丢失。

## 技术栈

- HTML5 + CSS3 + 原生 JavaScript
- localStorage 本地存储
- 移动端优先响应式设计
- 无后端、无框架、无依赖
