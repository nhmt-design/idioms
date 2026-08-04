# 南华熊成语平台：Cloudflare＋Supabase迁移操作说明

这份说明专门写给不熟悉代码的老师。请严格按顺序操作；每完成一大步再继续下一步。

## 先弄清楚：哪些东西不会改变

- 原来的Supabase数据库继续使用，学生、成绩和金卡记录不会搬家。
- 原来的学生登录方式不变：行政班＋学号＋个人登录码。
- 旧Netlify网站暂时保留，Cloudflare测试成功前不要删除。
- 不需要把任何密码或密钥发给协助修改代码的人。

## 第1步：先保存Netlify中的5个旧变量

这一步最重要，尤其是`LOGIN_CODE_PEPPER`。如果它改变，现有学生登录码会全部失效。

1. 登录Netlify。
2. 打开原项目`nhhs-idioms`。
3. 打开 **Project configuration**。
4. 找到 **Environment variables**。
5. 逐一找到并安全保存下面5项的原值：

   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET`
   - `LOGIN_CODE_PEPPER`
   - `TEACHER_PASSWORD`

6. 把它们暂存在自己的密码管理器或学校批准的安全位置。
7. 不要把这些值放进微信、WhatsApp、电子邮件、GitHub文件或聊天对话。

完成标准：5个变量一个不少，而且`LOGIN_CODE_PEPPER`确认是原值。

## 第2步：在Supabase运行一次迁移SQL

这一步让“答题保存”和“教师成绩汇总”在数据库内完成，避免Cloudflare免费版CPU超时。

1. 登录Supabase Dashboard。
2. 打开原来的成语平台项目，不要新建数据库。
3. 左边点击 **SQL Editor**。
4. 点击 **New query**。
5. 在GitHub迁移分支中打开：

   `supabase/migrations/002_cloudflare_functions.sql`

6. 点击文件右上角的复制按钮，复制全部SQL。
7. 回到Supabase，把SQL粘贴进查询框。
8. 点击右下角 **Run**。
9. 等待出现绿色成功提示。
10. 如果出现红色错误，先截图完整错误，不要重复乱按，也不要删除原有数据表。

完成标准：SQL Editor显示执行成功。这个SQL不会删除学生、成绩或金卡。

## 第3步：让Cloudflare连接GitHub

必须等迁移代码合并到GitHub的`main`分支后再做。

1. 打开Cloudflare Dashboard并登录。
2. 左边点击 **Workers & Pages**。
3. 点击 **Create application**。
4. 在“Import a repository”旁点击 **Get started**。
5. 选择 **GitHub**。
6. 第一次使用时，按提示授权Cloudflare访问GitHub。
7. 只选择仓库 `nhmt-design/idioms`。
8. 项目名称填写：`nhhs-idioms`。
9. Production branch选择：`main`。
10. Root directory留空。
11. Build command填写：`npm run build`。
12. Deploy command保持：`npx wrangler deploy`。
13. 点击 **Save and Deploy**。
14. 等待部署完成，并记下Cloudflare提供的`workers.dev`网址。

注意：Cloudflare项目名必须与代码中的`nhhs-idioms`完全一致，否则GitHub自动部署会失败。

## 第4步：在Cloudflare填写5个Secrets

第一次部署后，网页可能能打开，但登录和答题暂时不能用，这是因为Secrets还没有填写。

1. 在Cloudflare打开刚建立的`nhhs-idioms` Worker。
2. 点击 **Settings**。
3. 点击 **Variables & Secrets**。
4. 点击 **Add**。
5. 类型选择 **Secret**，不要选择普通明文变量。
6. 依次加入下面5项：

   | Name | Value从哪里来 |
   |---|---|
   | `SUPABASE_URL` | 第1步保存的原值 |
   | `SUPABASE_SERVICE_ROLE_KEY` | 第1步保存的原值 |
   | `SESSION_SECRET` | 第1步保存的原值 |
   | `LOGIN_CODE_PEPPER` | 第1步保存的原值 |
   | `TEACHER_PASSWORD` | 第1步保存的原值 |

7. 每项都确认拼写，没有空格，也没有中文引号。
8. 保存并部署新版本。

完成标准：Variables & Secrets页面能看到5个名称；值应显示为隐藏状态。

## 第5步：先做一个接口检查

把下面网址中的`你的网址`换成Cloudflare提供的真实网址：

`https://你的网址.workers.dev/api/student-login`

用Safari打开后，正确结果应是：

```json
{"ok":false,"error":"不支持的请求方式"}
```

这说明Cloudflare Worker已经接管`/api`接口。它不是故障，因为浏览器直接打开是GET，而登录接口只接受POST。

如果看到首页HTML、404网页或`usage_exceeded`，先停止，不要让学生使用。

## 第6步：用3名测试学生验收

不要一开始就让640名学生进入。

1. 打开Cloudflare新网址。
2. 确认首页、漫画缩略图和教师入口能打开。
3. 用真实教师密码登录教师后台。
4. 先查看原有学生成绩是否仍然存在。
5. 选3名测试学生：一名高级华文、一名快捷华文、一名不同的行政班。
6. 依次测试：

   - 学生登录；
   - 打开漫画；
   - 完成一组成语题；
   - 答错后再次练习；
   - 首次全对时获得对应金卡；
   - 刷新网页后进度仍在；
   - 换另一台设备登录后进度仍在；
   - 教师后台能看到最新成绩；
   - 排行榜能打开；
   - 教师CSV导出能下载。

7. 记录这3名学生测试前后的成绩，确认没有串号。

完成标准：上面10项全部通过。

## 第7步：进行700人压力测试

这一步由代码维护方执行，老师不需要输入命令。

1. 先运行本地700次提交模拟，确认一次答题只产生一次数据库请求。
2. 再对Cloudflare临时网址进行700个无效测试登录请求。
3. 分别记录成功/失败数量、最长响应时间和Cloudflare错误率。
4. 查看Cloudflare Worker用量与错误日志。
5. 查看Supabase API日志是否出现超时、连接不足或5xx错误。
6. 若出现明显错误，先调整批量和并发参数，再重测。

完成标准：700个请求全部得到预期响应，Cloudflare与Supabase没有5xx错误。

## 第8步：小范围试课

1. 先安排一个班，大约30至40名学生。
2. 同一时间让学生登录并完成2至3个成语。
3. 教师现场查看成绩是否持续写入。
4. 课后检查Cloudflare当天Worker请求量和Supabase日志。
5. 再安排两个班同时使用。

完成标准：两个班同时使用没有登录失败、答题丢失或成绩延迟。

## 第9步：全校切换

1. 提前通知教师使用Cloudflare新网址。
2. 更新Google Sites中的嵌入网址或按钮网址。
3. 保留旧Netlify网址至少一至两周，不要删除。
4. 上课前15分钟，用一名教师和一名学生各测试一次。
5. 第一轮全校使用时，分批让学生进入：例如不同年级相隔2至3分钟。
6. 稳定运行一至两周后，才考虑停止Netlify自动部署。

## 出现问题时怎样判断

| 现象 | 最可能原因 | 先做什么 |
|---|---|---|
| 首页能开，所有人不能登录 | Cloudflare Secrets缺少或错误 | 检查5个Secret名称和值 |
| 旧登录码全部失效 | `LOGIN_CODE_PEPPER`不是原值 | 恢复Netlify中的原值 |
| 登录成功但不能答题 | Supabase迁移SQL未运行 | 检查第2步 |
| 教师登录失败 | `TEACHER_PASSWORD`不一致 | 检查Cloudflare Secret |
| 漫画慢但答题正常 | 学校Wi-Fi或缓存尚未建立 | 先让一台设备打开并检查网络 |
| 出现5xx错误 | Worker或Supabase临时错误 | 保存时间、网址和完整截图 |

## 最重要的回退原则

如果Cloudflare测试没有全部通过，不要删除Supabase数据，不要重新导入全校名单，也不要关闭Netlify。直接让教师暂时使用原网址，待问题修复后再继续测试。
