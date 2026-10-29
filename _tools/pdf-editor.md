# PDF-Editor 部署维护

访问地址：https://wei2hu0.github.io/PDF-Editor/

`PDF-Editor/` 是上游项目的完整静态构建产物，随此仓库原有的 GitHub Pages / Jekyll 流程发布。主页的源文件、模板、数据和配置不需要修改。不要在仓库根目录添加 `.nojekyll`。

当前源码版本：[`42a5a17c22fbc98e34d3d21dda9d37bed52165fc`](https://github.com/JhuoW/PDF-Editor/tree/42a5a17c22fbc98e34d3d21dda9d37bed52165fc)。在线的 `PDF-Editor/source.json` 也记录了源码版本和构建信息。

## 重建

需要 Git、Node.js 20.19+ 或 22.12+（建议使用受支持的 LTS 版本）和 npm。在本仓库之外克隆上游，以免把源码及依赖一同提交：

```sh
git clone https://github.com/JhuoW/PDF-Editor.git ../PDF-Editor-source
git -C ../PDF-Editor-source checkout 42a5a17c22fbc98e34d3d21dda9d37bed52165fc
npm --prefix ../PDF-Editor-source ci
node _tools/build-pdf-editor.mjs ../PDF-Editor-source
```

脚本检查上游版本及工作区，执行 TypeScript 检查和 Vite 生产构建，并以 `/PDF-Editor/` 为资源前缀。构建使用上游配置，并给普通模块及 Worker 的 chunk 文件名添加 `chunk-` 前缀，避免 Jekyll 忽略 `__vite-browser-external` 文件。只有构建成功后才替换本仓库的 `PDF-Editor/` 目录。它保留 PDF.js 字体、CMaps、WASM、OCR 引擎及语言模型、依赖许可证，并将浏览器标题改为 `PDF Editor`、移除 Vite 示例图标。

审查 `git diff --stat`，确认现有主页文件没有变化，再将 `PDF-Editor/` 和 `_tools/` 的改动提交、推送到 `master`，由已有 Pages 流程发布。`_tools/` 因下划线前缀不会成为网站内容。

## 升级

先在上游选择并检出所需提交，再更新构建脚本中的 `revision` 和本文的版本记录，重新执行 `npm ci` 及构建命令。发布前检查 `/PDF-Editor` 跳转、PDF 打开/编辑/导出，以及中文 PDF 和 OCR 资源是否都从 `/PDF-Editor/` 加载。
