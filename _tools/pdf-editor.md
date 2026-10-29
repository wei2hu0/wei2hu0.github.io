# PDF-Editor 自动部署

访问地址：https://wei2hu0.github.io/PDF-Editor/

主页仓库中的 [Sync PDF Editor](https://github.com/wei2hu0/wei2hu0.github.io/actions/workflows/sync-pdf-editor.yml) 工作流每 15 分钟检查 `JhuoW/PDF-Editor` 的 `master`。发现新提交时，按完整提交 SHA 安装锁定依赖、执行 TypeScript 检查和生产构建，并更新 `PDF-Editor/`。GitHub 的定时调度可能排队延迟，不是上游推送后的即时触发。

工作流使用本仓库临时 `GITHUB_TOKEN`，不需要配置 PAT、部署密钥或上游仓库 Secret。可以在 Actions 页面选择 **Run workflow** 手动同步；修改工作流或构建脚本也会自动运行一次。

## 保持主页不变

- 自动提交只暂存 `PDF-Editor/`，发现该目录之外有任何改动便停止。
- 上游源码及依赖在 runner 临时目录构建，不会放入个人主页目录。
- 构建失败不会提交，也不会发布；构建期间如果主页 `master` 有新提交，本轮停止，下次基于新提交重试，不使用 force push。
- 保持原有 Pages 来源 `master` 根目录及 Jekyll 配置不变，不添加根 `.nojekyll`。
- 自动提交后显式请求现有 Pages 构建，因为 `GITHUB_TOKEN` 推送不会自行触发 Pages 发布。
- 每轮也检查线上 `source.json`；即使上游没有新提交，只要上次提交尚未发布，仍会重试发布。

上线版本及源码链接记录在 [source.json](https://wei2hu0.github.io/PDF-Editor/source.json)，包括上游 SHA 和打包脚本 SHA256。工作流成功前会核对线上与仓库里的完整 manifest 一致。

## 运行限制和维护

GitHub 会在公开仓库连续 60 天没有活动后自动禁用定时工作流。若长期没有更新，恢复使用时请在 Actions 页面启用工作流并点击 **Run workflow**。失败详情也在同一页面查看。要暂停同步，可在此工作流菜单选择 **Disable workflow**。

只有 `master` 更新会被同步，未合并的分支和 Pull Request 不会部署。该流程检查构建及资源完整性，不代替上游应用的全部功能测试。

参考：[GitHub 定时工作流规则](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)、[Pages 构建 API](https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build)。

## 本地重建

需要 Git、Node.js 24 和 npm。在本仓库之外克隆上游，以免提交源码和依赖：

```sh
git clone https://github.com/JhuoW/PDF-Editor.git ../PDF-Editor-source
git -C ../PDF-Editor-source checkout <完整的上游提交SHA>
npm --prefix ../PDF-Editor-source ci
node _tools/build-pdf-editor.mjs ../PDF-Editor-source <完整的上游提交SHA>
```

省略最后的 SHA 参数时，脚本要求源码与当前 `PDF-Editor/source.json` 记录的版本一致，适合重建已部署版本。脚本检查 SHA、源码 HEAD 和工作区，再使用上游 Vite 配置加 `/PDF-Editor/` 资源前缀构建。

普通模块及 Worker 的 chunk 文件名添加 `chunk-` 前缀，防止 Jekyll 忽略 `__vite-browser-external` 文件。产物保留 PDF.js 字体、CMaps、WASM、OCR 引擎及语言模型、依赖许可证；浏览器标题为 `PDF Editor`，移除 Vite 示例图标。`.gitattributes` 保证产物字节不会被 Git 换行转换修改。

`_tools/` 和 `.github/` 不属于网站公开内容。修改同步逻辑后，检查 Actions 首次运行成功，并确认主页源文件未被改变。
