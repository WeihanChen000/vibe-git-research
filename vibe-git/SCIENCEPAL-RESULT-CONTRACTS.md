# 冻结成果格式：从提示要求到执行门禁

2026-10-29。本轮针对首次 Iris 实验发现的实际问题：提案要求二维数组和布尔字段，但产出变成对象行、数字字符串和范围对象。数值虽然可以独立核对，下游接收方却不能依赖原先约定的类型。

## 已落地的行为

新建项目可填写 `resultSchemas`，以任务键映射到 JSON Schema；Iris 模板自动填写。规则在创建时验证并存为不可变的 `result-contracts.json`，有独立 SHA-256 和下载入口。

1. 对齐负责人收到完整冻结规则；没有未决冲突的对齐结果必须完整匹配任务键。任务上的规则由 Host 从冻结文件绑定，不采信 Agent 返回的替代定义。
2. 每次任务的真实成果先核对文件、版本、输入回执，再对信封内 `result` 校验格式。
3. 失败时保存原始文件，运行标记 `INVALID`，项目 `BLOCKED`，显示 JSON 路径及错误。此时没有提交独立评审，也不会给下游交接此文件。
4. 显式重试沿用原附件、同一规则，并将具体失败原因交给 Agent；旧失败记录保留，最多三次执行。格式失败是机器门禁结果，不冒称另一 Agent 作出的评审退回。
5. 格式通过后，继续由另一真实 Agent 逐项评审科学内容。格式正确不证明数据或结论正确。
6. 返工、Host 重启和需求 R+1 沿用原规则。当前不支持改变格式约束；需要不同任务键或格式时新建项目。旧项目不追溯添加新规则，也不显示为已通过新校验。
7. 证据回顾重新读取冻结规则，并重新检查已采集任务成果；导出包含规则文件和逐次校验结果。读取历史不产生远端调用。

## 支持范围

规则只约束信封的 `result`。根类型为 object，支持嵌套 object、array、固定元组、string、number、integer、boolean、null，以及 properties、required、additionalProperties、items、additionalItems、min/maxItems、min/maxLength、minimum、maximum、标量 enum/const、description。

不支持的关键字会被拒绝，不会静默忽略。不开放 `$ref`、远端加载、正则、组合条件、自定义代码和异步校验。每份映射 2–6 个任务、最多 24 KiB、总计 256 个节点、8 层嵌套、元组 16 项。该范围是产品选择，不能宣称支持完整 JSON Schema 标准。

采用 Ajv draft-07 校验引擎，`strict=true`；不做类型转换、不补默认值、不删多余字段，不改写成果。返回首个错误即可阻止运行，避免一次生成大量错误。编译缓存最多 64 份定义。

```json
{
  "data": {
    "type": "object",
    "properties": { "value": { "type": "number" } },
    "required": ["value"],
    "additionalProperties": false
  },
  "analysis": {
    "type": "object",
    "properties": { "mean": { "type": "number" } },
    "required": ["mean"],
    "additionalProperties": false
  }
}
```

创建接口仍为 `POST /api/sciencepal/projects`，在原 title/coordinatorId/proposals/source 外新增可选 `resultSchemas`。留空使用原有流程；填写 null、空映射、不支持的定义等会返回创建错误。

## 工程验证

`npm run test:sciencepal`：61 项通过（原 48 项加本轮 13 项）。新增行为覆盖：

- 四类错误产物：数字字符串、缺字段、数组变对象、额外字段；均无评审和下游调用、原字节不变，重启并显式修复重试后完成。
- 对齐输出试图替换规则无效；删除或重命名受约束任务导致对齐失败。
- 返工、变更版本和归档继续使用同一规则。
- 篡改冻结规则阻止派发和证据读取；引用、正则、默认值、组合规则和危险字段名在创建时拒绝。
- Iris 固定元组可通过；历史对象行和对象形式 overlap 不符合新约束。类型通过的重复物种测试数据仍需要内容评审，测试不把格式视为科学正确。

完整构建、工作区类型检查通过。原 Host 12 项上游既有失败未纳入“全项目通过”声明。构建仍提示原主包超过 500 kB，本轮 Ajv 只在 Host 执行，没有打入前端包。

## 复用决策

按 AGENTS.md 检索：`gh search repos "ajv json schema" --limit 3`、`gh search repos "ajv in:name user:ajv-validator" --limit 3`。

最适合的候选是 [ajv-validator/ajv](https://github.com/ajv-validator/ajv)：MIT，未归档，最近推送 2026-09-06，README 有完整文档、测试和 CI 指引；本机 8.20.0 已被 Fastify 间接安装，运行依赖四项。不采用搜索中的 ajv-i18n、ajv-merge-patch 或教学示例，它们不能替代核心校验器。最终将同一 Ajv 8.20.0 作为 Host 直接依赖，通过离线安装更新声明和锁文件，没有复制第三方源码。

参考 [官方选项文档](https://ajv.js.org/options.html) 关闭数据修改，参考 [官方安全说明](https://ajv.js.org/security.html) 限制定义大小、深度及可用结构。MIT 许可兼容该依赖使用；它不改变原 Vibe-Git 上游授权尚待明确的现状，当前副本仍仅本地私有使用。

## 真实验证记录

独立项目 `8b08bb50-b7d9-421d-8b92-8bd1f7dd42e5`：“公开科研数据复核 · Iris 冻结格式验证”。原案例及退回返工项目没有改写。本次使用原公开数据的相同字节，不要求 Agent 故意犯错。

已于北京时间 17:10:52 完成。5 次真实远端运行均成功采集，两个任务各执行一次，机器格式校验均为 PASSED，独立评审分别为 6/6 与 8/8。没有格式失败、评审退回或重试；不得把自动测试的负向样本说成真实 Agent 曾犯错。

| 步骤 | 真实 SciencePAL Run ID |
|---|---|
| 对齐 | `8c8b6861-b304-4e50-a3e0-68c95b2c5153` |
| A 数据审计 | `1ead966a-e511-4570-a7c4-94d193f01d49` |
| B 评审数据 | `4a91f3e7-d12f-4084-bd4d-db948b5cbfc1` |
| B 统计复算 | `744219c7-a030-4520-bdcb-41955eb566cb` |
| A 评审统计 | `15773828-9e66-467f-b3b4-89c25a1088e3` |

冻结格式文件 4922 字节，SHA-256：`38be0adf412120bb362f6d9a1e9aa0a3dcbb7aa8bfa2fd0e2e98c3fef5e83120`。本机完整报告共 12 份文件；通用脚本的 11 份计数只覆盖运行输入输出，另一份是项目级冻结格式。

| 真实输出字段 | 旧案例（没有机器约束） | 新案例（创建时冻结） |
|---|---|---|
| rows 的每行 | 对象 | 五项元组 |
| 原始测量值 | 数字字符串 | number |
| limitations | string | string[] |
| versicolor_virginica_range_overlap | 包含范围的 object | boolean |

旧文件和原批准记录没有改写，也没有给旧项目追贴新的格式通过标签。两例均使用相同 4551 字节 UCI 原始数据。本机从 CSV 独立复算的所有均值、范围、排序和重叠结论正确；花瓣均值仍为 1.462、4.260、5.552 cm。

- `verify-sciencepal-live.mjs <本项目ID>`：55/55 通用文件、身份、回执、交接时序检查通过。
- `verify-sciencepal-iris.mjs <本项目ID>`：44/44 数值、来源、实际类型、冻结格式字节及模板一致性检查通过。`plannedFaultTest.status=NOT_REQUESTED`。
- 浏览器验证模板自动填写、冻结规则下载入口、真实格式通过和独立评审分别显示；390px 窄屏无整体横向溢出，恢复默认视口后保留演示页，未捕获到 error 日志。
- 证据目录：`data/sciencepal/evidence/8b08bb50-b7d9-421d-8b92-8bd1f7dd42e5/`，含 `verification.json`、`iris-verification.json`、`research-report.json`、`format-comparison.json` 和运行原始文件。

[打开真实项目](http://127.0.0.1:8788/sciencepal?project=8b08bb50-b7d9-421d-8b92-8bd1f7dd42e5&view=evidence)。重复复核只读已保存证据；不要再次创建项目来“刷新”演示。

## 评审后的下一优先级

此前明确的类型漂移缺口已在本轮补上，并有新真实运行佐证。继续优先完善 NEEDS_INPUT 的安全续聊绑定、初始化等待说明与明确恢复动作，减少现场人工排查；随后邀请真实研究使用者评估价值。暂不增加更多平台、自动放宽格式或无限自动返工。机器格式检查和数值复算仍不替代研究设计、统计方法和科学结论的人工判断。
