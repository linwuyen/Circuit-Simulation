# Unified Causal Kernel — 白話版

這一版的目標很簡單：**以前像五個分開的小實驗，現在要變成同一台虛擬電源。**

## 為什麼要改？

如果 DMA lab 說「資料舊了」，但 System Lab 的輸出完全不受影響，那學習者只是在背概念。

真正的工程世界是：

```text
新 command
   ↓
DMA / buffer
   ↓
控制器真正吃到的 command
   ↓
ADC sample
   ↓
PI 算 duty
   ↓
PWM 有沒有來得及更新
   ↓
power stage
   ↓
Vout / current
   ↓
protection / state
```

所以這一版把這些事情放進同一個 causal kernel。

## 1. Timing 不再只是畫時間軸

以前可以看到 `CONTROL_DONE` 很晚，但 plant 還是照樣拿到新 duty。

現在規則是：

```text
CONTROL_DONE + PWM_COMMIT <= period
    → 下一拍可以吃到新 duty

CONTROL_DONE + PWM_COMMIT > period
    → 錯過 load point
    → 下一拍繼續用舊 duty
```

所以 ISR jitter、ADC sample 太晚、control code 太慢，都可能真的造成 missed update。

## 2. ADC 真的在你選的時間點取樣

一個 PWM period 內，switch ON/OFF 會讓 inductor current 有漣波。

SOC 設在 25% 與 75%，ADC 取到的 current 不會再是同一個 cycle-level 數字，而是取當下的 plant state。

這讓「sample point 為什麼重要」不再只是文字說明。

## 3. Stale command 真的會讓輸出跟舊命令

預設 command 會從 24 V 跳到 48 V。

正常情況：

```text
producer = 48 V
consumer = 48 V
```

stale 情況：

```text
producer 已經是 48 V
consumer 還在用 24 V
```

控制器就真的繼續按照 24 V 算 duty，直到 consumer 追上。

## 4. Protection latency 真的會改 fault stress

以前 `tripLatencyUs` 比較像一個標在 timeline 上的數字。

現在 current 超過 threshold 後，PWM 會等到真正的 trip actuation time 才關。

因此 latency 越長：

- peak current 越高；
- fault-energy proxy 越大；
- 最後 state 進入 `FAULT`，PWM 保持 OFF。

## 5. Multi-fault 不再用預先寫好的提示句

DMM、raw ADC、scaled value、duty、sequence、timing 現在都直接從 hidden system simulation 讀值。

也就是：

```text
hidden faults
    ↓
同一台 machine 真的跑壞
    ↓
你選 measurement
    ↓
才從 machine 讀 evidence
```

不是 `fault → 固定文字答案`。

## 6. Code bug 真的會改機器

例如選 feedback sign bug：

```c
error = measured - reference;
```

不是只顯示「positive feedback」四個字。

System kernel 會真的把 control sign 反過來，再重新跑 converter，所以 duty 與 Vout 會真的變。

`shadow` bug 則會真的把 control completion 推過 PWM deadline，產生 missed commit。

## 7. State 真的控制 PWM permission

`RUN` 才允許 power stage 動作。

```text
OFF / READY / FAULT / RECOVERY
    → PWM OFF

RUN + prerequisites OK + no fault
    → PWM allowed
```

所以 state machine 不再只是流程圖，它直接決定 physical output 能不能建立。

## 8. 學習紀錄

Sandbox 仍沿用 V5 learning state，不建立新 schema。

- system run：保存 machine practice evidence；
- multi-fault PASS：保存 diagnostic history；
- 不因為 simulator 變複雜就亂升級成新的 A-grade hardware evidence。

## 最後只要記住一件事

這一版的核心不是「模擬得更花俏」，而是：

> **同一個原因，必須能一路追到同一個物理後果。**

工程師真正要練的是這條因果鏈，而不是記住每一頁的答案。
