# 摆摊 AI 助手

一款基于微信小程序 + 腾讯云开发的 AI 摆摊选址助手。输入摆摊品类和偏好后，结合 GPS 定位、周边 POI 数据和 AI 分析，生成选址报告，帮助摊主找到更合适的摆摊地点。

## 功能

- **智能选址**：获取当前位置，分析周边 500 米内的学校、商场、地铁、小区等人流量相关设施
- **AI 评估报告**：调用 DeepSeek 大模型，根据品类和周边环境生成选址建议
- **问卷调研**：填写摆摊品类、时段、预算等偏好，辅助 AI 分析
- **地图展示**：在地图上可视化展示候选摊位位置
- **历史记录**：查看和管理历史生成的选址报告

## 技术栈

- 微信小程序（原生开发）
- 腾讯云开发（云函数 + 云数据库）
- DeepSeek API（AI 分析）
- 腾讯地图 API（逆地址解析 + POI 搜索）

## 云函数

| 云函数 | 功能 |
|---|---|
| `analyzeLocation` | 获取位置信息和周边 POI，调用 AI 生成选址报告 |
| `generateReport` | 根据问卷结果生成详细评估报告 |
| `deleteReport` | 删除历史报告 |

## 部署步骤

### 1. 前置准备

- 注册微信小程序并开通云开发环境
- 申请 [DeepSeek API Key](https://platform.deepseek.com/)
- 申请 [腾讯地图 API Key](https://lbs.qq.com/)

### 2. 配置 AppID

打开 `project.config.json`，将 `appid` 替换为你的小程序 AppID：

```json
"appid": "你的AppID"
```

### 3. 配置云函数环境变量

在腾讯云开发控制台，为 `analyzeLocation` 和 `generateReport` 云函数设置以下环境变量：

- `DEEPSEEK_API_KEY`：你的 DeepSeek API 密钥
- `TMAP_KEY`：你的腾讯地图 API 密钥

### 4. 部署云函数

在微信开发者工具中，右键每个云函数目录 → **上传并部署（云端安装依赖）**，或运行：

```bash
bash uploadCloudFunction.sh
```

### 5. 初始化数据库

在云开发控制台创建集合：`reports`

### 6. 运行

用微信开发者工具打开项目根目录，编译预览即可。

## 目录结构

```
├── cloudfunctions/        # 云函数
│   ├── analyzeLocation/   # 位置分析
│   ├── generateReport/    # 报告生成
│   └── deleteReport/      # 报告删除
├── miniprogram/           # 小程序前端
│   ├── pages/             # 页面（home/questionnaire/map/report/history）
│   ├── components/        # 公共组件
│   └── images/            # 图片资源
└── project.config.json    # 项目配置
```

## License

MIT
