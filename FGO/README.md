# FGO UI Assets (`MySTStuff/FGO`)

SillyTavern FGO 角色卡外置 UI 静态素材包（已全部压缩为 WebP，统一纯英文小写路径）。

## 推荐 CDN 引用（带版本锁定与多源兜底）

```javascript
const FGO_ASSET_TAG = 'fgo-v1.0.0';
const FGO_ASSET_BASES = [
  `https://cdn.jsdelivr.net/gh/HitagiTore/MySTStuff@${FGO_ASSET_TAG}/FGO/`,
  `https://testingcf.jsdelivr.net/gh/HitagiTore/MySTStuff@${FGO_ASSET_TAG}/FGO/`,
  `https://raw.githubusercontent.com/HitagiTore/MySTStuff/${FGO_ASSET_TAG}/FGO/`,
];
```

## 目录结构

| 目录 | 说明 | 文件数 | 压缩后体积 |
| :--- | :--- | ---: | ---: |
| `assets/class-icons/` | 全职阶图标（金/银/铜/黑框，80×80 WebP） | 96 | 272.8 KB |
| `assets/card-backs/` | 全职阶卡背（金/银/铜/冠位/黑，512×875 WebP） | 78 | 9.08 MB |
| `assets/frames/` | 卡框、列表底框、指令卡与徽标 HUD | 61 | 804.4 KB |
| `assets/backgrounds/` | 迦勒底管制室与剧情背景、冬木终端地图 | 21 | 1.97 MB |
| `assets/menu-buttons/` | 菜单按钮、栏条与功能图标 | 71 | 580.2 KB |
| `assets/atlas/` | 技能与物品雪碧图（WebP + 坐标 JSON） | 4 | 579.3 KB |
| `assets-manifest.json` | 全量素材索引（含宽高、字节数、SHA-256、预加载策略） | 1 | 132.5 KB |

## 更新说明

每次新增或替换图片后，建议推送并打新标签（如 `fgo-v1.1.0`），然后仅更新卡片里的 `FGO_ASSET_TAG`，既避开 `@main` 最长 12 小时 CDN 缓存，也不会破坏旧版本卡片。
