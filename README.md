# 南华熊成语闯关平台：Netlify Functions＋Supabase版

## 2026-07-23：24张金卡与漫画编号修正版

- 第47—70条各有一张独立金卡，共24张，不再循环复用3张图片。
- 金卡按 `47.jpg` 至 `70.jpg` 与对应成语绑定，收藏页显示准确卡号。
- 修正漫画导出错位：PPT封面不再占用第47条；第65、66条按成语编号而非幻灯片页序命名；第70条完整保留。
- 保留首次整组全对才发卡的规则，以及鼠标、触控滑动金光和轻微3D倾斜效果。

这份项目已经包含：

- 第47—70条成语漫画及题目
- 1—138号七个单元预留
- 教师上传CSV教学班名单
- 高华整班与快华跨班合班
- 自动生成学生个人登录码
- 学生跨设备登录与进度同步
- “首次整组全对”金卡判定
- 教学班、行政班、同课程排行榜
- 正确答案只保存在Supabase，不写入公开网页

## 最重要：不要使用普通“拖放文件夹”

这个版本含有Netlify Functions。普通的“Deploys → Drag and drop”只适合旧版静态网页，不能可靠地构建云函数。

代码小白最稳定的部署方法是：

1. 把本文件夹上传到你现有的GitHub仓库 `nhmt-design/idioms`。
2. 在Netlify现有项目 `nhhs-idioms` 连接该GitHub仓库。
3. Netlify会读取 `netlify.toml`，自动发布 `public`，并部署 `netlify/functions`。

下面是完整操作。

## 第一步：建立Supabase项目

1. 打开 <https://supabase.com/dashboard> 并登录。
2. 点击 **New project**。
3. 填写项目名，例如 `nhhs-idioms`。
4. 设置一个数据库密码并保存好。
5. Region选择离新加坡较近的区域。
6. 等待项目建立完成。

## 第二步：建立数据表和正确答案

1. 在Supabase左侧点击 **SQL Editor**。
2. 点击 **New query**。
3. 打开本项目的 `supabase/migrations/001_schema.sql`，复制全部内容，粘贴后点击 **Run**。
4. 再建立一个New query。
5. 打开另外保存的私密文件 `Supabase私密初始化_正确答案47-70.sql`，复制全部内容，粘贴后点击 **Run**。
6. 两次都显示成功才继续。

提醒：私密初始化文件含正确答案，绝对不要上传GitHub、Netlify或放进网页文件夹。

## 第三步：取得Supabase的两个连接值

1. 在Supabase项目左侧点击 **Project Settings**。
2. 打开 **API**。
3. 复制：
   - Project URL
   - `service_role` secret key
4. `service_role`是最高权限密钥，只能放入Netlify环境变量，不能发给学生，也不能写进HTML或JavaScript。

## 第四步：把代码放进GitHub

如果你的 `nhmt-design/idioms` 仓库现在只有旧网页：

1. 先下载或备份旧仓库。
2. 打开GitHub仓库。
3. 点击 **Add file → Upload files**。
4. 上传本文件夹内的全部内容，保持目录结构不变。
5. 第一层必须看到：

```text
netlify.toml
package.json
public/
netlify/
supabase/
scripts/
tests/
README.md
```

6. 提交说明填写：`Convert to Netlify Functions and Supabase`
7. 点击 **Commit changes**。

注意：GitHub网页不适合一次上传过多图片。如果图片上传失败，建议安装GitHub Desktop，把整个项目复制到本地仓库后点击 **Commit to main → Push origin**。

## 第五步：让现有Netlify项目连接GitHub

1. 登录 <https://app.netlify.com/>。
2. 打开现有项目 `nhhs-idioms`，不要新建项目。
3. 打开 **Project configuration → Build & deploy → Continuous deployment**。
4. 点击 **Link repository** 或 **Manage repository**。
5. 选择GitHub仓库 `nhmt-design/idioms`。
6. Netlify会自动读取：
   - Build command：`npm run build`
   - Publish directory：`public`
   - Functions directory：`netlify/functions`
7. 保存。

## 第六步：在Netlify添加五个环境变量

进入：

**Project configuration → Environment variables → Add a variable**

逐一加入：

| Key | Value |
|---|---|
| `SUPABASE_URL` | Supabase的Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase的service_role secret |
| `SESSION_SECRET` | 自己生成的长随机字符串，至少32位 |
| `LOGIN_CODE_PEPPER` | 另一个不同的长随机字符串，至少32位 |
| `TEACHER_PASSWORD` | 教师管理页面的强密码 |

`SESSION_SECRET`和`LOGIN_CODE_PEPPER`可以在电脑命令行分别运行：

```bash
openssl rand -hex 32
```

每运行一次会得到一个不同的64位字符串。

## 第七步：重新部署

1. 打开Netlify项目的 **Deploys**。
2. 点击 **Trigger deploy → Deploy site**。
3. 等待状态变成 **Published**。
4. 打开 <https://nhhs-idioms.netlify.app/>。

检查顺序：

1. 首页能看到47—70条成语。
2. 点击“教师入口”。
3. 用你在Netlify设置的 `TEACHER_PASSWORD` 登录。
4. 下载CSV模板。
5. 先用3至5名测试学生上传。
6. 下载系统产生的“学生个人登录码CSV”。
7. 用其中一个学生账号登录并答题。
8. 换浏览器或设备登录，确认进度仍存在。
9. 查看教学班、行政班和同课程排行榜。

## CSV名单格式

```csv
admin_class,student_number,course_type,teaching_class
101,01,HCL,101-HCL
101,34,CL,101-103-CL-A
102,35,CL,101-103-CL-A
103,33,CL,101-103-CL-A
```

- `admin_class`：101—108或201—208
- `student_number`：学生在行政班的学号
- `course_type`：高级华文填 `HCL`，快捷华文填 `CL`
- `teaching_class`：实际授课班，例如 `101-HCL` 或 `101-103-CL-A`

## 更新名单时要注意

以“行政班＋学号”为同一学生的身份。再次导入相同学生会更新课程、教学班和登录码，但不会删除其闯关进度。

每次重新导入都会产生新的登录码；旧登录码随即失效。因此，正式导入全校名单后，请立即下载并妥善保存登录码CSV。

## 安全说明

- 正确答案存在Supabase的 `idiom_answers` 表。
- GitHub与Netlify部署包不含正确答案SQL。
- 浏览器只能看题干和选项。
- 学生提交整组答案后，由Netlify Function核对。
- 金卡由云端按照“第一次完整提交是否全部答对”决定。
- 学生无法通过修改浏览器的localStorage补发金卡。
- 排行榜不显示姓名，只显示行政班与学号。
- Supabase已启用RLS，浏览器不能直接读取数据库。
