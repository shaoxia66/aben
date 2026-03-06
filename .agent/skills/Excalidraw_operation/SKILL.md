---
name: obsidian-excalidraw
description: 为 Obsidian Excalidraw 插件生成画板数据文件（.excalidraw）。当用户要求绘制流程图、架构图、思维导图、关系图等可视化图表并希望在 Obsidian 中打开时，使用此技能。触发词：excalidraw、obsidian画图、生成画板、流程图、架构图、思维导图、.excalidraw 文件。必须始终用 Python 脚本生成文件，不能手写 JSON。
---

# Obsidian Excalidraw 画板生成技能

生成可直接在 Obsidian Excalidraw 插件中打开的 `.excalidraw` 文件。

---

## ⚠️ 必须使用 Python 脚本生成

**绝对不允许手写 JSON。** 文本坐标、绑定关系极易出错，必须通过下方的 Python 工具函数生成，然后用 `present_files` 提供下载。

---

## 两大核心问题与解法

### 问题一：箭头绑定（拖节点时箭头不跟随）

绑定是**双向**的，箭头和节点必须互相引用，缺一不可：

```
箭头侧：arrow.startBinding.elementId = shape.id
        arrow.endBinding.elementId   = shape.id

节点侧：shape.boundElements 包含 {"type": "arrow", "id": arrow.id}
```

### 问题二：文本缩放时乱跑

所有文本元素必须加 `"autoResize": true`。Excalidraw 加载时会自动重算实际尺寸，JSON 里写的 width/height 只是初始估算值。

---

## Python 标准工具库（每次必须使用）

```python
import json, random

BOUND_TEXT_PADDING = 5   # 容器内边距（四边各 5px，源码常量）
LINE_HEIGHT = 1.25

def uid(prefix=""):
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return prefix + "".join(random.choices(chars, k=8))

def rnd():
    return random.randint(1000000, 9999999)

def text_height(font_size, lines=1):
    return round(font_size * LINE_HEIGHT * lines)

def baseline_val(font_size):
    return round(font_size * LINE_HEIGHT)


def make_shape_with_text(shape_type, x, y, w, h, text,
                          font_size=20, stroke="#1e1e1e", bg="transparent",
                          fill="solid", roughness=1, roundness=None):
    """创建形状 + 绑定文本，返回 (shape_id, [shape_elem, text_elem])"""
    shape_id = uid("s")
    text_id  = uid("t")
    lines    = text.count("\n") + 1
    th       = text_height(font_size, lines)
    tx = x + BOUND_TEXT_PADDING
    ty = y + (h - th) / 2          # 垂直居中
    tw = w - 2 * BOUND_TEXT_PADDING

    shape = {
        "id": shape_id, "type": shape_type,
        "x": x, "y": y, "width": w, "height": h,
        "angle": 0, "strokeColor": stroke, "backgroundColor": bg,
        "fillStyle": fill, "strokeWidth": 2, "strokeStyle": "solid",
        "roughness": roughness, "opacity": 100,
        "groupIds": [], "frameId": None, "roundness": roundness,
        "seed": rnd(), "version": 1, "versionNonce": rnd(),
        "isDeleted": False,
        "boundElements": [{"type": "text", "id": text_id}],
        "updated": 1706000000000, "link": None, "locked": False
    }
    text_elem = {
        "id": text_id, "type": "text",
        "x": tx, "y": ty, "width": tw, "height": th,
        "angle": 0, "strokeColor": stroke, "backgroundColor": "transparent",
        "fillStyle": "hachure", "strokeWidth": 1, "strokeStyle": "solid",
        "roughness": 1, "opacity": 100,
        "groupIds": [], "frameId": None, "roundness": None,
        "seed": rnd(), "version": 1, "versionNonce": rnd(),
        "isDeleted": False, "boundElements": None,
        "updated": 1706000000000, "link": None, "locked": False,
        "text": text, "rawText": text, "originalText": text,
        "fontSize": font_size, "fontFamily": 1,
        "textAlign": "center", "verticalAlign": "middle",
        "baseline": baseline_val(font_size),
        "containerId": shape_id,   # ← 指向容器
        "autoResize": True,        # ← 必须！防止缩放时文本乱跑
        "lineHeight": LINE_HEIGHT
    }
    return shape_id, [shape, text_elem]


def make_label(x, y, text, font_size=14, stroke="#868e96"):
    """独立标签文本（箭头旁的"是/否"等），autoResize:true"""
    lines  = text.count("\n") + 1
    est_w  = max(len(l) for l in text.split("\n")) * font_size * 0.65
    th     = text_height(font_size, lines)
    return {
        "id": uid("l"), "type": "text",
        "x": x, "y": y, "width": round(est_w), "height": th,
        "angle": 0, "strokeColor": stroke, "backgroundColor": "transparent",
        "fillStyle": "hachure", "strokeWidth": 1, "strokeStyle": "solid",
        "roughness": 1, "opacity": 100,
        "groupIds": [], "frameId": None, "roundness": None,
        "seed": rnd(), "version": 1, "versionNonce": rnd(),
        "isDeleted": False, "boundElements": None,
        "updated": 1706000000000, "link": None, "locked": False,
        "text": text, "rawText": text, "originalText": text,
        "fontSize": font_size, "fontFamily": 1,
        "textAlign": "left", "verticalAlign": "top",
        "baseline": baseline_val(font_size),
        "containerId": None,   # ← 独立文本
        "autoResize": True,    # ← 必须！
        "lineHeight": LINE_HEIGHT
    }


def make_arrow(x1, y1, x2, y2, start_shape_id, end_shape_id,
               stroke="#1e1e1e", label=None):
    """
    创建箭头（含箭头侧绑定）。
    x1,y1 = 源节点边缘中心绝对坐标
    x2,y2 = 目标节点边缘中心绝对坐标
    返回 (arrow_id, [arrow_elem, ...label_elem])
    调用后必须再调用 bind_arrow_to_shape() 完成节点侧绑定！
    """
    arrow_id = uid("a")
    dx, dy   = x2 - x1, y2 - y1
    arrow = {
        "id": arrow_id, "type": "arrow",
        "x": x1, "y": y1,
        "width": abs(dx), "height": abs(dy),
        "angle": 0, "strokeColor": stroke, "backgroundColor": "transparent",
        "fillStyle": "hachure", "strokeWidth": 2, "strokeStyle": "solid",
        "roughness": 1, "opacity": 100,
        "groupIds": [], "frameId": None,
        "roundness": {"type": 2},
        "seed": rnd(), "version": 1, "versionNonce": rnd(),
        "isDeleted": False, "boundElements": [],
        "updated": 1706000000000, "link": None, "locked": False,
        "points": [[0, 0], [dx, dy]],
        "lastCommittedPoint": [dx, dy],
        "startArrowhead": None, "endArrowhead": "arrow",
        "startBinding": {              # ← 箭头侧绑定（必须）
            "elementId": start_shape_id,
            "focus": 0,                # 0=中心，-1~1 控制左右/上下偏移
            "gap": 8,                  # 距节点边框间距 px
            "fixedPoint": None
        },
        "endBinding": {
            "elementId": end_shape_id,
            "focus": 0, "gap": 8, "fixedPoint": None
        }
    }
    elems = [arrow]
    if label:
        lx = x1 + dx / 2 + (8 if dx >= 0 else -30)
        ly = y1 + dy / 2 + (8 if dy >= 0 else -24)
        elems.append(make_label(lx, ly, label, stroke=stroke))
    return arrow_id, elems


def bind_arrow_to_shape(shape_elem, arrow_id):
    """
    节点侧绑定：向形状 boundElements 追加箭头引用。
    对每条箭头的 start_shape 和 end_shape 都必须调用一次！
    """
    existing = [e["id"] for e in shape_elem.get("boundElements", [])]
    if arrow_id not in existing:
        shape_elem["boundElements"].append({"type": "arrow", "id": arrow_id})


def build_excalidraw(elements):
    return {
        "type": "excalidraw",
        "version": 2,
        "source": "https://excalidraw.com",
        "elements": elements,
        "appState": {"gridSize": 20, "viewBackgroundColor": "#ffffff"},
        "files": {}
    }
```

---

## 节点边缘中心坐标（箭头连接点）

```
矩形 / 椭圆 / 菱形（x, y 为左上角，w/h 为宽高）：

  顶边中心：(x + w/2,  y      )
  底边中心：(x + w/2,  y + h  )
  左边中心：(x,        y + h/2)
  右边中心：(x + w,    y + h/2)
```

---

## 标准调用模式

```python
all_elements = []

# 1. 创建节点
s1_id, e1 = make_shape_with_text("rectangle", 100, 100, 200, 70, "步骤一",
    stroke="#1971c2", bg="#a5d8ff", roundness={"type": 3})
all_elements.extend(e1)
s1_elem = e1[0]   # 保留 shape 元素引用，用于 bind_arrow_to_shape

s2_id, e2 = make_shape_with_text("rectangle", 100, 250, 200, 70, "步骤二",
    stroke="#1971c2", bg="#a5d8ff", roundness={"type": 3})
all_elements.extend(e2)
s2_elem = e2[0]

# 2. 创建箭头（节点底边中心 → 下一节点顶边中心）
a_id, ae = make_arrow(200, 170, 200, 250, s1_id, s2_id)
all_elements.extend(ae)

# 3. 节点侧绑定（必须，缺少则拖动时箭头不跟随）
bind_arrow_to_shape(s1_elem, a_id)
bind_arrow_to_shape(s2_elem, a_id)

# 4. 保存
diagram = build_excalidraw(all_elements)
with open("/mnt/user-data/outputs/diagram.excalidraw", "w", encoding="utf-8") as f:
    json.dump(diagram, f, indent=2, ensure_ascii=False)
```

---

## 颜色方案

| 用途        | strokeColor  | backgroundColor |
|-----------|-------------|----------------|
| 开始 / 结束  | `#2f9e44`   | `#b2f2bb`      |
| 普通步骤     | `#1971c2`   | `#a5d8ff`      |
| 判断 / 分支  | `#e67700`   | `#ffec99`      |
| 错误 / 失败  | `#e03131`   | `#ffc9c9`      |
| 存储 / 数据库 | `#9c36b5`   | `#e5dbff`      |
| 外部系统     | `#868e96`   | `#f1f3f5`      |

---

## 形状类型速查

| 形状    | shape_type   | roundness        | 推荐用途     |
|--------|-------------|------------------|-----------|
| 矩形    | `rectangle`  | `None`           | 步骤 / 模块 |
| 圆角矩形 | `rectangle`  | `{"type": 3}`    | 步骤（柔和）|
| 椭圆   | `ellipse`    | `None`           | 开始 / 结束 |
| 菱形   | `diamond`    | `None`           | 判断 / 分支 |

---

## 验证函数（生成后必须执行）

```python
def validate(elements):
    shape_ids = {e["id"] for e in elements
                 if e["type"] in ["rectangle", "ellipse", "diamond"]}
    arrow_ids = {e["id"] for e in elements if e["type"] == "arrow"}
    ok = True
    for e in elements:
        if e["type"] == "text" and not e.get("autoResize"):
            print(f"❌ 文本 {e['id']} 缺少 autoResize:true"); ok = False
        if e["type"] == "arrow":
            for side in ["startBinding", "endBinding"]:
                b = e.get(side)
                if not b or b["elementId"] not in shape_ids:
                    print(f"❌ 箭头 {e['id']} {side} 目标不存在"); ok = False
        if e["type"] in ["rectangle", "ellipse", "diamond"]:
            for ref in e.get("boundElements", []):
                if ref["type"] == "arrow" and ref["id"] not in arrow_ids:
                    print(f"❌ 节点 {e['id']} 引用不存在箭头 {ref['id']}"); ok = False
    if ok:
        print("✅ 验证通过")

validate(all_elements)
```

---

## 生成完成后

1. 用 `present_files` 提供 `.excalidraw` 文件下载
2. 告知用户：**将文件放入 Obsidian vault，点击即可打开，拖动节点箭头自动跟随**
