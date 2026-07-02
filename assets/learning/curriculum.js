(function (global) {
  "use strict";

  const modules = [
    {
      id: "buck",
      number: "0",
      tag: "Buck",
      title: "降壓轉換器 Buck",
      entry: "0_buck_converter_/index.html",
      oneLine: "Buck 不是把電壓直接變小，而是快速切換，再用電感與電容把平均值撫平。",
      analogy: "像快速開關水龍頭再用水桶平均水量；開得久一點，平均水位就高一點。",
      whyUseful: "能直接用在電源設計：估 L/C、預估漣波、判斷輕載是否進 DCM。",
      lessons: [
        ["0_what_is_buck.html", "先懂切換平均值", "只看開關占空比如何決定平均輸出。", "改 Duty，看平均輸出往哪裡走。", "輸出約等於 Vin × Duty。"],
        ["1_inductor_triangle.html", "電感三角波", "只看電感如何反抗電流突變。", "改 Vin/Vout/L，看斜率變化。", "L 越大，電流變化越慢。"],
        ["2_current_ripple.html", "電流漣波", "把 ΔI 當成設計指標。", "改 L 與 fsw，讓 ΔI 低於目標。", "L 或 fsw 增大，漣波下降。"],
        ["3_cap_voltage_ripple.html", "電容電壓漣波", "看 C 與 ESR 如何影響輸出紋波。", "分別拉 C 與 ESR，比較哪個主導。", "低 ESR 對高頻紋波很關鍵。"],
        ["4_ccm_vs_dcm.html", "CCM / DCM", "理解輕載時電感電流為何掉到 0。", "降低負載電流，找出臨界點。", "進 DCM 後轉移關係不再只是 Duty。"]
      ],
      labs: [
        ["buck-ripple", "設計一組 20% 電流漣波", "0_buck_converter_/2_current_ripple.html", "給定 Vin/Vout/Iout，把 L 或 fsw 調到 ΔI 約為 Iout 的 20%。", "畫面顯示 ΔI/Iout 接近 20%。", "這就是實務選電感值的第一步。"],
        ["buck-output-ripple", "把輸出漣波壓到規格內", "0_buck_converter_/3_cap_voltage_ripple.html", "先固定負載，再調 C 與 ESR，讓 ΔV 低於目標。", "知道是容量不足還是 ESR 太高。", "能對應到電容選型與並聯策略。"],
        ["buck-dcm", "找出輕載 DCM 邊界", "0_buck_converter_/4_ccm_vs_dcm.html", "慢慢降低負載電流，記下電感電流剛好碰到 0 的點。", "找到 CCM 轉 DCM 的臨界負載。", "用來判斷控制策略是否要支援 DCM。"]
      ],
      faults: [
        ["輸出漣波太大", "C 太小、ESR 太高或電感電流漣波太大。", "先看電感 ΔI，再分離電容充放電與 ESR 造成的 ΔV。", "增大 L、提高 fsw、換低 ESR 電容或並聯電容。", "0_buck_converter_/3_cap_voltage_ripple.html"],
        ["電感發熱或飽和", "峰值電流超過電感飽和電流。", "用平均電流加上 ΔI/2 估峰值。", "提高電感飽和電流規格或降低漣波。", "0_buck_converter_/2_current_ripple.html"],
        ["輕載輸出不如預期", "進入 DCM 後，Vout 不再只由 Duty 決定。", "觀察電感電流是否碰到 0。", "調整補償、加入脈衝跳週期或採用 DCM 模型。", "0_buck_converter_/4_ccm_vs_dcm.html"]
      ]
    },
    {
      id: "adc",
      number: "1",
      tag: "ADC",
      title: "C2000 ADC 參數計算",
      entry: "1_c2000_adc_calculator/index.html",
      oneLine: "ADC 只懂 0 到 3.3V；電路要先把真實電流與高壓縮放、平移，再由韌體還原。",
      analogy: "像把很大的地圖縮印到一張紙上，再用比例尺換回真實距離。",
      whyUseful: "能直接產生電流/電壓量測鏈的分壓、Offset、係數與 C code。",
      lessons: [
        ["1_adc_basics.html", "ADC 基礎", "理解 0 到 4095 代表什麼。", "改 Vref 與 bits，看解析度變化。", "LSB 是最小可分辨電壓。"],
        ["2_current_to_voltage.html", "電流變電壓", "Shunt 與放大器如何把 A 變成 V。", "改 Rshunt 與 Gain，看輸出範圍。", "不要超過 ADC 量程。"],
        ["3_why_offset.html", "為什麼要 Offset", "雙向電流需要中點偏移。", "把 Offset 拿掉，看負電流如何消失。", "0A 通常對應 ADC 中間值。"],
        ["4_voltage_divider.html", "高壓分壓", "母線電壓如何縮到 3.3V 內。", "調 Rtop/Rbot，看 ADC 端電壓。", "要留過壓餘裕。"],
        ["5_firmware_scaling.html", "韌體還原", "把 ADC count 換回 A/V。", "改比例係數，看還原結果。", "硬體比例必須與韌體一致。"]
      ],
      labs: [
        ["adc-offset", "設計 ±20A 電流量測", "1_c2000_adc_calculator/6_full_calculator.html", "設定電流範圍、Shunt、Gain 與 Offset，讓全範圍都落在 0 到 3.3V。", "最小/最大電流不撞上下限。", "可直接轉成控制器電流回授設計。"],
        ["adc-divider", "400V 母線分壓", "1_c2000_adc_calculator/4_voltage_divider.html", "輸入最大母線電壓，選 Rtop/Rbot，保留過壓餘裕。", "ADC 端最高電壓小於 Vref。", "避免 ADC 腳位過壓。"],
        ["adc-code", "產生韌體縮放係數", "1_c2000_adc_calculator/5_firmware_scaling.html", "把硬體比例輸入後複製 C code。", "ADC count 可還原成真實 A/V。", "減少硬體與韌體係數不一致。"]
      ],
      faults: [
        ["負電流讀不到", "沒有 Offset，或 Offset 不在 ADC 中點。", "輸入負電流，看 ADC 電壓是否低於 0。", "加中點偏移並重新計算韌體扣除值。", "1_c2000_adc_calculator/3_why_offset.html"],
        ["高壓量測飽和", "分壓比例太小或 Vref 設定錯。", "用最大母線電壓驗算 ADC 腳位電壓。", "調整分壓電阻並保留 transient 餘裕。", "1_c2000_adc_calculator/4_voltage_divider.html"],
        ["韌體顯示比例錯", "硬體 Gain、Shunt 或分壓係數與韌體不一致。", "用已知電流/電壓校準兩點。", "更新縮放係數與 Offset 常數。", "1_c2000_adc_calculator/5_firmware_scaling.html"]
      ]
    },
    {
      id: "inverter",
      number: "2",
      tag: "Inverter",
      title: "電力電子拓撲 / 逆變器",
      entry: "2_code_artifact/index.html",
      oneLine: "逆變器用高速開關把直流切成可控的平均電壓，再用負載或濾波器看起來像交流。",
      analogy: "像用很快的黑白閃爍，在眼睛裡混成不同灰階。",
      whyUseful: "能判斷半橋、SPWM、全橋、濾波與三相 SVPWM 的實際取捨。",
      lessons: [
        ["course/01_inductor_diode.html", "電感與續流", "先懂電流為何需要路徑。", "切換開關，看電感電流是否中斷。", "續流路徑是開關電源基本安全線。"],
        ["course/02_half_bridge.html", "半橋與直通", "理解上下臂不能同時導通。", "嘗試錯誤開關組合。", "直通就是母線短路。"],
        ["course/03_pwm_basics.html", "PWM 平均電壓", "用占空比控制平均值。", "調 Duty，看輸出平均值。", "開關波形可代表類比命令。"],
        ["course/04_spwm.html", "SPWM", "用 PWM 畫正弦。", "調調變比與頻率。", "調變比提高，輸出幅值提高。"],
        ["course/08_harmonics_thd.html", "THD 量測", "把波形好壞量化。", "比較不同調變與濾波。", "THD 是電能品質指標。"]
      ],
      labs: [
        ["inv-shoot", "找出直通危險組合", "2_code_artifact/course/02_half_bridge.html", "切換上下臂狀態，觀察哪些組合會造成短路。", "能指出 forbidden state。", "對應到 dead-time 與 gate driver 保護。"],
        ["inv-filter", "調 LC 濾波器", "2_code_artifact/course/06_load_and_filter.html", "改 L/C 與負載，讓輸出更接近正弦。", "高頻紋波下降，低頻目標保留。", "用於逆變器輸出濾波設計。"],
        ["inv-thd", "比較 SPWM 與 SVPWM", "2_code_artifact/course/08_harmonics_thd.html", "切換調變法並記錄 THD。", "看出母線利用率與諧波差異。", "用來選擇控制策略。"]
      ],
      faults: [
        ["上下臂直通", "PWM 互補訊號沒有死區或邏輯錯誤。", "檢查上下臂是否同時為 ON。", "加入 dead-time 與硬體互鎖。", "2_code_artifact/course/02_half_bridge.html"],
        ["輸出 THD 太高", "調變比過高、濾波不足或開關頻率太低。", "看頻譜與 THD 指標。", "降低調變比、提高 fsw 或重設 LC。", "2_code_artifact/course/08_harmonics_thd.html"],
        ["LC 濾波後振盪", "濾波器共振與負載/控制迴路互動。", "改負載與 C，看振盪頻率是否跟 LC 共振一致。", "加阻尼、改截止頻率或調控制器。", "2_code_artifact/course/06_load_and_filter.html"]
      ]
    },
    {
      id: "foc",
      number: "3",
      tag: "FOC",
      title: "FOC 從零到診斷",
      entry: "3_foc_course/index.html",
      oneLine: "FOC 把三相交流電流轉成跟轉子一起轉的 dq 直流量，讓 PI 控制器變得好用。",
      analogy: "像坐到旋轉木馬上看旁邊的人；原本一直轉的東西，在你的視角裡變成固定方向。",
      whyUseful: "能用波形形狀判斷 ADC 失配、死區、過調變與解耦問題。",
      lessons: [
        ["L0-why-foc.html", "為什麼需要 FOC", "先看六步與 FOC 的差別。", "比較扭矩波動。", "FOC 讓扭矩更平滑。"],
        ["L2-clarke.html", "Clarke 變換", "三相壓成 αβ。", "觀察三相與向量關係。", "三相可以用一支箭頭表示。"],
        ["L3-park.html", "Park 變換", "αβ 轉成 dq。", "改角度，看交流如何變直流。", "dq 直流量才適合 PI 控制。"],
        ["L7-deadtime.html", "死區時間", "看 60 度週期誤差。", "拉 dead-time，看星形變明顯。", "死區會留下特徵諧波。"],
        ["L9-capstone.html", "完整診斷示波器", "整合 αβ、dq、三相時域。", "切換故障預設，先猜再驗證。", "三種視角一起看才有診斷力。"]
      ],
      labs: [
        ["foc-park", "把交流變直流", "3_foc_course/L3-park.html", "調轉子角度，觀察 dq 分量如何變穩定。", "dq 在正確角度下近似直流。", "對應到電流環 PI 控制。"],
        ["foc-fault", "用波形判斷故障", "3_foc_course/L9-capstone.html", "切換增益失配、死區、過調變，先看 αβ 猜原因，再看 dq 驗證。", "能把形狀對到故障。", "調機時可當示波器判讀訓練。"],
        ["foc-dict", "建立故障字典", "3_foc_course/fault-dictionary.html", "選一個症狀，寫出量測點與修正方式。", "能說出原因、量測、修法。", "現場 debug 時能快速縮小範圍。"]
      ],
      faults: [
        ["αβ 軌跡變橢圓", "兩相 ADC 增益不一致。", "看 dq 是否出現二倍頻脈動。", "重新校正 offset/gain。", "3_foc_course/L6-adc-gain.html"],
        ["αβ 軌跡像六角星", "死區或功率級非線性。", "低速小電流時最明顯。", "加入死區補償並確認電流方向。", "3_foc_course/L7-deadtime.html"],
        ["軌跡貼到六邊形", "電壓命令超過母線可用範圍。", "看三相是否削頂。", "弱磁、提高 Vdc 或降低扭矩命令。", "3_foc_course/L8-overmodulation.html"]
      ]
    },
    {
      id: "pi",
      number: "4",
      tag: "PI",
      title: "PI 控制器波德圖",
      entry: "4_PI/index.html",
      oneLine: "PI 控制器用 Kp 決定反應力度，用 Ki 消除長期誤差，但太 aggressive 會降低穩定度。",
      analogy: "像開車追前車：Kp 是立刻踩油門的力道，Ki 是看到長期落後後越補越多的耐心。",
      whyUseful: "能把時域震盪、超調、反應慢與 Bode 圖上的相位裕度連起來。",
      lessons: [
        ["01_what_is_bode.html", "Bode 圖的一個點", "先讀懂增益與相位。", "看單一頻率輸入輸出。", "Bode 是頻率掃描地圖。"],
        ["02_integrator.html", "積分器 Ki/s", "看積分器低頻增益。", "改 Ki，看低頻增益抬升。", "Ki 用來吃掉穩態誤差。"],
        ["03_pi_controller.html", "PI 控制器", "拆 Kp 與 Ki 的角色。", "分別調 Kp/Ki。", "零點位置影響相位補償。"],
        ["06_stability.html", "穩定度", "看 fc/PM/GM 與階躍響應。", "調參讓 PM 保持合理。", "相位裕度不足會震盪。"],
        ["07_challenge.html", "挑戰任務", "自己調出好控制器。", "依任務限制調 Kp/Ki。", "把公式變成設計手感。"]
      ],
      labs: [
        ["pi-tune", "調出不震盪的 PI", "4_PI/06_stability.html", "先提高 Kp 加快反應，再加 Ki 消除誤差，觀察 PM。", "階躍快速且不連續震盪。", "對應電流環/電壓環調參。"],
        ["pi-ki", "觀察 Ki 過大", "4_PI/02_integrator.html", "逐步提高 Ki，觀察低頻增益與相位。", "理解 Ki 帶來的相位負擔。", "避免積分太強造成振盪。"],
        ["pi-challenge", "完成穩定度挑戰", "4_PI/07_challenge.html", "依目標調參並通過任務。", "任務狀態顯示通過。", "建立可重複的調參流程。"]
      ],
      faults: [
        ["系統持續震盪", "交越頻率太高或相位裕度不足。", "看 PM 是否太低。", "降低 Kp/Ki 或補償零點。", "4_PI/06_stability.html"],
        ["反應太慢", "Kp 太低或頻寬不足。", "看 fc 是否遠低於目標。", "提高 Kp，確認 PM 仍足夠。", "4_PI/03_pi_controller.html"],
        ["穩態誤差消不掉", "Ki 太小或被限幅/抗飽和限制。", "看長時間誤差是否存在。", "提高 Ki 並檢查輸出飽和。", "4_PI/02_integrator.html"]
      ]
    },
    {
      id: "spi",
      number: "5",
      tag: "SPI",
      title: "SPI 初學者課程",
      entry: "5_spi/index.html",
      oneLine: "SPI 是主機用時鐘節拍推資料；每送出一個 bit，也同時收回一個 bit。",
      analogy: "像兩個人用節拍器同步交換卡片，節拍錯了就會拿到前一張或下一張。",
      whyUseful: "能直接排查接線、Mode、FIFO、Overrun 與實機通訊問題。",
      lessons: [
        ["lesson_00_what.html", "SPI 是什麼", "知道何時使用 SPI。", "對比 UART/I2C。", "SPI 快但線較多。"],
        ["lesson_01_wires.html", "四條線", "SCLK/MOSI/MISO/CS 的角色。", "改接線，看資料流。", "接錯線會完全無資料。"],
        ["lesson_04_mode.html", "CPOL/CPHA", "理解四種 Mode。", "切模式，看取樣邊緣。", "Mode 錯會位移或亂碼。"],
        ["lesson_05_fifo_why.html", "為什麼需要 FIFO", "資料量大時緩衝很重要。", "提高速率，看 FIFO 水位。", "FIFO 給 ISR/DMA 反應時間。"],
        ["lesson_08_debug.html", "症狀除錯表", "從現象反查原因。", "選症狀，看檢查順序。", "先查線再查時序。"]
      ],
      labs: [
        ["spi-mode", "故意設錯 Mode", "5_spi/lesson_04_mode.html", "切換 CPOL/CPHA，觀察資料在哪個邊緣被取樣。", "能說出哪一種 Mode 正確。", "實機接 DAC/AFE 常見問題。"],
        ["spi-fifo", "壓力測試 FIFO", "5_spi/lesson_06_overrun.html", "提高資料速率或延遲 ISR，觀察 overrun。", "知道 FIFO 深度與服務時間的關係。", "評估何時需要 DMA。"],
        ["spi-wire", "做接線檢查", "5_spi/lesson_07_wiring.html", "依序確認 SCLK、MOSI、MISO、CS 與 GND。", "排除最常見硬體錯誤。", "把 debug 流程標準化。"]
      ],
      faults: [
        ["MISO 永遠 0 或 FF", "MISO 沒接、CS 沒拉低、Slave 沒供電或沒有共地。", "先用示波器看 CS/SCLK，再看 MISO 是否浮動。", "修接線、共地與片選邏輯。", "5_spi/lesson_07_wiring.html"],
        ["資料位移一位", "CPHA/CPOL 錯或 setup/hold margin 不足。", "對照 datasheet 的 Mode 圖。", "改 SPI Mode 或降低 SCLK。", "5_spi/lesson_04_mode.html"],
        ["高速時偶發漏資料", "FIFO overrun 或 ISR 太慢。", "看 FIFO 水位與 overrun flag。", "加大 FIFO、縮短 ISR、改 DMA。", "5_spi/lesson_06_overrun.html"]
      ]
    },
    {
      id: "loop10us",
      number: "6",
      tag: "10us",
      title: "10μs 高頻控制迴路",
      entry: "6.10μs 高頻控制迴路模擬器/index.html",
      oneLine: "高頻控制的核心不是算得多複雜，而是所有讀取、運算、通訊、輸出都必須在 10μs 內準時完成。",
      analogy: "像每 10μs 發車一次的列車，任何乘客晚到都會拖累整條路線。",
      whyUseful: "能估算 CPU、ADC、FSI、DAC 的時間預算，避免實機 missed deadline。",
      lessons: [
        ["教學版/01-deadline.html", "10μs 截止線", "先建立時間預算概念。", "塞入不同任務。", "總時間不能超過週期。"],
        ["教學版/02-epwm.html", "EPWM 硬體鬧鐘", "用硬體觸發控制節拍。", "改觸發點。", "硬體同步比軟體輪詢穩。"],
        ["教學版/03-adc.html", "ADC ACQPS", "理解取樣保持時間。", "改 ACQPS，看取樣品質。", "太短會讀到錯值。"],
        ["教學版/05-fsi.html", "FSI 通訊", "估資料傳輸佔用時間。", "改 payload。", "payload 越大越吃預算。"],
        ["教學版/07-full.html", "完整時序", "整合所有時間片。", "調參讓總時間合格。", "完整排程才是實務重點。"]
      ],
      labs: [
        ["loop-budget", "排出 10μs 預算", "6.10μs 高頻控制迴路模擬器/教學版/07-full.html", "調 ADC、CPU、FSI、DAC 時間，讓總線不超過 10μs。", "畫面顯示仍有 timing margin。", "決定控制頻率是否可行。"],
        ["loop-acqps", "找 ADC 取樣保持下限", "6.10μs 高頻控制迴路模擬器/教學版/03-adc.html", "縮短 ACQPS，觀察何時量測不可信。", "能說出速度與精度取捨。", "對應 TRM 裡的 ADC timing 設定。"],
        ["loop-fsi", "估算 FSI payload", "6.10μs 高頻控制迴路模擬器/教學版/05-fsi.html", "提高 payload，觀察通訊時間佔比。", "知道多少資料會吃掉 margin。", "多板同步時先做時間預算。"]
      ],
      faults: [
        ["控制迴路偶發超時", "CPU 運算、通訊或 ADC 時間超過預算。", "看完整時序中哪一段壓到 10μs 邊界。", "降低控制頻率、優化 ISR 或搬到硬體加速。", "6.10μs 高頻控制迴路模擬器/教學版/07-full.html"],
        ["ADC 數值延遲或不準", "取樣點或 ACQPS 不合適。", "調整 EPWM 觸發與 ADC 取樣保持。", "把取樣點放在電流穩定區，延長 ACQPS。", "6.10μs 高頻控制迴路模擬器/教學版/03-adc.html"],
        ["跨板資料來不及", "FSI payload 太大或鏈路配置不足。", "計算每 frame 傳輸時間。", "縮 payload、提高速率或分散週期。", "6.10μs 高頻控制迴路模擬器/教學版/05-fsi.html"]
      ]
    },
    {
      id: "bms",
      number: "7",
      tag: "BMS",
      title: "F28388D BMS 教學",
      entry: "7.28388d_bms_tutorial/START_HERE.html",
      oneLine: "BMS 是一條因果鏈：量測、比較、決定、致動、回報；任一步危險就進入安全狀態。",
      analogy: "像工廠產線的安檢門：每站只做一件事，但任何站發現危險都能停線。",
      whyUseful: "能把 AFE、狀態機、接觸器、UDS 與多核協同串成安全邏輯。",
      lessons: [
        ["01_overview.html", "系統總覽", "先看完整因果鏈。", "走一遍量測到回報。", "不要把判斷與動作混在一起。"],
        ["02_sense.html", "AFE 量測", "理解感測輸入。", "改量測值。", "AFE 提供資料，不做最終決策。"],
        ["04_decide.html", "狀態機", "看 INIT/STANDBY/DISCHARGE/FAULT。", "觸發條件轉移。", "安全狀態要明確鎖住。"],
        ["06_report.html", "CAN/UDS 回報", "理解診斷通訊與 NRC。", "送 UDS 指令。", "負回應本身就是重要資訊。"],
        ["09_integrate.html", "整合實驗", "把整條鏈串起來。", "注入故障並追 log。", "建立測試案例。"]
      ],
      labs: [
        ["bms-chain", "追一顆量測值的旅程", "7.28388d_bms_tutorial/09_integrate.html", "從電壓輸入開始，觀察比較、狀態機、接觸器與回報。", "能說出每一步誰負責。", "系統安全分析與測試案例設計。"],
        ["bms-uds", "跑一組 UDS 解鎖流程", "7.28388d_bms_tutorial/06_report.html", "依序送 10 03、27 01、27 02、31 01。", "看懂正回應與 NRC。", "診斷服務開發與測試。"],
        ["bms-failsafe", "注入失效安全", "7.28388d_bms_tutorial/08_failsafe.html", "觸發過壓/通訊失效，確認 FAULT_LOCK。", "系統不會默默自動恢復。", "符合安全設計直覺。"]
      ],
      faults: [
        ["進入 FAULT_LOCK", "量測超限、比較層判定危險或致動異常。", "沿量測、比較、決定、致動順序查 log。", "先排除真故障，再設計明確復歸條件。", "7.28388d_bms_tutorial/08_failsafe.html"],
        ["預充失敗", "接觸器順序、預充電阻或母線電容電壓未達門檻。", "看預充電壓是否到約 95%。", "檢查接觸器命令與回授。", "7.28388d_bms_tutorial/05_actuate.html"],
        ["UDS 被拒絕", "session/security/routine 條件不滿足。", "讀 7F 後面的 NRC。", "先切 session、做 seed/key，再執行 routine。", "7.28388d_bms_tutorial/06_report.html"]
      ]
    },
    {
      id: "ad5543",
      number: "8",
      tag: "AD5543",
      title: "AD5543 DAC 教學",
      entry: "8.ad5543_simulator/index.html",
      oneLine: "AD5543 把 16-bit 數位碼當比例，去縮放 VREF，最後用 TIA 把電流輸出變電壓。",
      analogy: "像用 0 到 65535 格的精密旋鈕，決定參考電壓要被取多少比例。",
      whyUseful: "能把 DAC code、VREF、RFB、TIA、誤差校正與 SPI 送碼連起來。",
      lessons: [
        ["01-ratio.html", "比例旋鈕", "先懂 D/65536。", "改 code 看比例。", "DAC 本質是比例器。"],
        ["02-binary.html", "數位碼與位元", "理解 16-bit 解析度。", "改 hex code。", "1 LSB 是最小步階。"],
        ["04-tia-rfb.html", "TIA + RFB", "電流輸出如何變電壓。", "改 RFB/VREF。", "RFB 決定輸出比例。"],
        ["07-errors.html", "真實誤差與校正", "看 offset/gain error。", "套兩點校正。", "實機一定要校正。"],
        ["08-spi-design.html", "SPI 與設計計算機", "把目標輸出轉成送碼。", "輸入目標電壓。", "產生可用送碼流程。"]
      ],
      labs: [
        ["dac-code", "算出目標輸出的 DAC code", "8.ad5543_simulator/08-spi-design.html", "輸入 VREF/RFB/目標輸出，找出 hex code。", "輸出 code 與預期電壓一致。", "直接用於韌體送碼。"],
        ["dac-cal", "做 Offset/Gain 校正", "8.ad5543_simulator/07-errors.html", "設定一組誤差，套校正後比較前後。", "校正後誤差下降。", "對應量產校準流程。"],
        ["dac-polarity", "確認輸出極性", "8.ad5543_simulator/05-polarity.html", "切換參考與 TIA 拓撲，觀察輸出正負。", "知道哪一種接法會反相。", "避免板子做出來極性相反。"]
      ],
      faults: [
        ["輸出極性相反", "VREF 極性或 TIA 接法造成反相。", "看轉移函數符號。", "改參考極性或調整後級反相。", "8.ad5543_simulator/05-polarity.html"],
        ["滿刻度不準", "Gain error、RFB 誤差或 VREF 誤差。", "用兩點量測分離 offset/gain。", "做 gain calibration 或換高精度元件。", "8.ad5543_simulator/07-errors.html"],
        ["SPI 寫入沒反應", "Frame 格式、片選、時序或 LDAC 控制錯。", "用邏輯分析儀看 SCLK/MOSI/CS。", "對照 datasheet 修 frame 與時序。", "8.ad5543_simulator/08-spi-design.html"]
      ]
    },
    {
      id: "afe",
      number: "9",
      tag: "AFE",
      title: "AFE 入門拆解",
      entry: "9.afe-tutorial/START_HERE.html",
      oneLine: "AFE 是接在電網與 DC bus 之間的可控能量閘門，核心是讓電流、電壓與相位被閉迴路控制。",
      analogy: "像雙向收費站，車流可以進也可以出，但每一台車都要按規則排隊通過。",
      whyUseful: "能用波形、相位、PI 參數與實驗紀錄判斷 AFE 控制狀態。",
      lessons: [
        ["01-concepts.html", "觀念地圖", "先懂 AFE 做什麼。", "切模式看能量方向。", "AFE 不是一般整流器。"],
        ["02-waveforms.html", "波形判讀", "看相位與波形形狀。", "調相位角。", "相位決定功率方向與功率因數。"],
        ["03-control-loop.html", "控制迴路拆解", "PLL/PI/電壓電流環。", "調 PI 參數。", "閉迴路品質決定穩定度。"],
        ["04-lab.html", "實驗工作台", "記錄參數與觀察。", "填實驗紀錄並匯出 CSV。", "把學習變成可交付紀錄。"],
        ["simulator.html", "教練版模擬器", "整合操作。", "依提示改參數。", "回到完整系統視角。"]
      ],
      labs: [
        ["afe-phase", "調相位看功率方向", "9.afe-tutorial/02-waveforms.html", "改相位角，觀察電壓/電流相對位置。", "能判斷吸收或回送功率。", "對應功率因數與併網控制。"],
        ["afe-pi", "調 PI 看穩定度", "9.afe-tutorial/03-control-loop.html", "改 Kp/Ki，觀察響應速度與震盪。", "找到快速但不震盪的區間。", "對應電流環/電壓環調參。"],
        ["afe-record", "完成一筆實驗紀錄", "9.afe-tutorial/04-lab.html", "填負載、THD、相位與觀察，匯出 CSV。", "有可追溯的參數紀錄。", "適合交作業或比較調參版本。"]
      ],
      faults: [
        ["電流相位不對", "PLL、相位命令或座標方向錯。", "比較電壓與電流零交越。", "檢查 PLL 鎖相與 dq 軸定義。", "9.afe-tutorial/02-waveforms.html"],
        ["THD 偏高", "調變、濾波或控制參數不佳。", "看波形是否削頂或有高頻殘留。", "降低命令、調濾波或重新調 PI。", "9.afe-tutorial/04-lab.html"],
        ["PI 調參後震盪", "Kp/Ki 太高或迴路相位裕度不足。", "做階躍並看是否衰減。", "降低增益並分開調電流/電壓環。", "9.afe-tutorial/03-control-loop.html"]
      ]
    },
    {
      id: "acmc-pro",
      number: "10",
      tag: "ACMC",
      title: "ACMC-PRO 雙迴路控制逆變器",
      entry: "10.acmc-pro_power_simulator/00_system_map.html",
      oneLine: "ACMC-PRO 把 PFC、相移全橋、SiC 逆變器、同步採樣、PLL 與硬體保護放在同一個系統中觀察。",
      analogy: "像把整套電力電子實驗台縮到一張儀表板：左邊調條件，右邊看波形、保護與效率一起變化。",
      whyUseful: "能練習從系統層判斷 ZVS、OCP、同步採樣、功率因數、DDS 解析度與 PLL 鎖相的實務取捨。",
      lessons: [
        ["00_system_map.html", "系統架構總覽", "先看 PFC、PSFB、Inverter、DAQ 四段如何串接。", "切換重點段落，從左到右追一次能量路徑。", "功率級不是單一方塊，而是一連串互相牽動的能量路徑。"],
        ["01_switching_ripple.html", "開關頻率與漣波", "理解 SiC 高頻開關為何能縮小濾波需求。", "把 f_sw 從 100kHz 降到 20kHz，觀察示波器高頻鋸齒。", "頻率越低，單週期能量擺幅越大，漣波越明顯。"],
        ["02_zvs_light_load.html", "ZVS 輕載邊界", "看負載太低時 ZVS 為什麼失效。", "慢慢降低負載，找到 ZVS 能量比低於 1 的區間。", "輕載硬切換會拉低效率並提高溫升。"],
        ["03_sampling_noise.html", "同步採樣與 EMI", "看 ADC 若採到開關瞬間會發生什麼。", "在同步與隨機採樣間切換，比較噪聲爆發。", "採樣點設計常比後端濾波更關鍵。"],
        ["04_pll_phase.html", "SOGI-PLL 鎖相", "理解併網模式下相位追蹤的角色。", "關閉 PLL 或加入市電相位漂移，觀察相位誤差。", "鎖相品質會直接影響併網功率方向與穩定度。"],
        ["05_ocp_trip.html", "硬體保護鎖死", "看 DAC OCP 與 DC offset 如何觸發保護。", "降低 OCP 或提高直流偏壓，觀察 trip reason。", "實務保護要快、明確，而且不能默默自動恢復。"],
        ["06_full_system_lab.html", "整合實驗", "把漣波、ZVS、採樣與 OCP 裕度一起調到合格。", "調 f_sw、負載、採樣模式與 OCP 門檻，讓整體判定 PASS。", "設計評審看的是整組條件都有裕度。"],
        ["index.html", "完整儀表板", "回到原始大型模擬器。", "把前面找到的參數帶回完整系統觀察。", "最後要能在完整儀表板中解釋每個指標。"]
      ],
      labs: [
        ["acmc-zvs", "找出 ZVS 失效邊界", "10.acmc-pro_power_simulator/02_zvs_light_load.html", "慢慢降低 P_load，觀察 ZVS 能量比何時低於 1。", "能記錄大約低於哪個負載區間開始硬切換。", "用來理解 PSFB 輕載效率與熱設計風險。"],
        ["acmc-sampling", "比較同步與隨機採樣", "10.acmc-pro_power_simulator/03_sampling_noise.html", "維持同一組負載與頻率，只切換 ADC 採樣模式。", "能說出示波器中噪聲差異與原因。", "對應 C2000 EPWM 觸發 ADC 的實機設定。"],
        ["acmc-protection", "觸發 OCP 與 DC SAT 保護", "10.acmc-pro_power_simulator/05_ocp_trip.html", "調低 OCP 限制或提高 DC 偏壓，讓系統進入不同 trip reason。", "能描述 trip reason、鎖死狀態與復歸條件。", "建立硬體保護測試流程。"],
        ["acmc-full", "完成整機參數合格任務", "10.acmc-pro_power_simulator/06_full_system_lab.html", "調整 f_sw、負載、採樣模式與 OCP，讓整體判定 PASS。", "漣波、ZVS、同步採樣與 OCP 裕度都合格。", "接近設計評審的參數驗證流程。"]
      ],
      faults: [
        ["ZVS 失效或效率下降", "負載太低，原邊電流不足以在死區時間內完成 Coss 充放電。", "看 ZVS 能量比、負載功率與死區時間。", "調整最小負載策略、死區、諧振電感或切換頻率。", "10.acmc-pro_power_simulator/02_zvs_light_load.html"],
        ["ADC 波形噪聲突然變大", "採樣點落在 SiC 開關 dv/dt 瞬間。", "切回同步採樣並比較突波是否消失。", "用 EPWM SOCA/SOCB 固定在頂點或谷底採樣。", "10.acmc-pro_power_simulator/03_sampling_noise.html"],
        ["系統硬體跳機", "OCP 門檻太低、負載電流太高或 DDS 直流偏壓造成磁飽和。", "讀 trip reason，分別調 OCP、負載與 DC offset 驗證。", "先解除真故障，再設計明確 reset 與保護裕度。", "10.acmc-pro_power_simulator/05_ocp_trip.html"]
      ]
    },
    {
      id: "c2000-dds",
      number: "11",
      tag: "DDS",
      title: "C2000 電力測量與 DDS 儀表板",
      entry: "11.c2000_dds_dashboard/00_measurement_map.html",
      oneLine: "這個儀表板把 DDS 訊號、ADC 偏壓、動態 offset 校正、RMS、實功、功率因數與過零頻率計算串在一起。",
      analogy: "像一台透明的電表：不只顯示 Vrms、Irms、P、PF，也把內部暫存器與計算過程攤開。",
      whyUseful: "能直接練習 C2000 電力測量常見問題：偏壓錯、雜訊大、採樣率不足、過零抖動與校正策略。",
      lessons: [
        ["00_measurement_map.html", "量測鏈總覽", "先懂 DDS、ADC、Offset、RMS/PF 如何串接。", "切換重點段落，追一次量測鏈。", "任何一段錯，最後顯示值都可能錯。"],
        ["01_adc_offset.html", "ADC Offset 校正", "比較固定扣 2048 與 LPF 動態校正。", "改硬體 Offset，再切換校正模式。", "偏壓不是理想固定值，韌體需要估測與補償。"],
        ["02_dds_waveform.html", "DDS 訊號源與 ADC 範圍", "先懂電壓峰值、頻率與 offset 如何組成 ADC 前端訊號。", "調 V_peak 與 offset，看 ADC 腳位是否超出 0 到 3.3V。", "送進 ADC 的訊號必須落在安全範圍內。"],
        ["03_rms_calculation.html", "RMS 與累積暫存器", "看 vSqrSum 與 nSamples 如何形成量測結果。", "改 Vpeak 與單週期點數，看 Vrms 是否接近理想值。", "RMS 計算需要完整週期與穩定取樣。"],
        ["04_power_pf.html", "電流相位與功率因數", "看電壓電流相位差如何影響實功與 PF。", "把 phase 從負到正調整，觀察 P 與 PF。", "同樣 Vrms/Irms 下，相位會決定真正做功多少。"],
        ["05_zero_crossing.html", "過零偵測", "理解頻率回算依賴乾淨的 zero crossing。", "提高 noise，觀察頻率估測與 jitter。", "雜訊會讓過零點抖動，進而影響頻率與週期統計。"],
        ["06_noise_jitter.html", "Noise 與 Jitter", "理解 hysteresis 如何降低過零誤觸發。", "提高 noise，再調 hysteresis，觀察 jitterCount。", "門檻太小抗噪差，太大會延遲或漏判。"],
        ["07_calibration_lab.html", "校正整合實驗", "把 offset、noise 與校正模式一起調到可交付。", "讓整體判定 PASS，並記錄參數。", "量測報告需要校正策略與可信度說明。"],
        ["index.html", "完整儀表板", "回到原始大型儀表板。", "把拆解頁學到的現象對到暫存器與示波器。", "最後要能解釋顯示值從何而來。"]
      ],
      labs: [
        ["dds-offset", "故意製造 offset 誤差", "11.c2000_dds_dashboard/01_adc_offset.html", "把 Offset 調離 1.65V，先用固定扣 2048，再切回動態 LPF 校正。", "能說出 Vrms 誤差如何被校正改善。", "對應實機 ADC 中點漂移與溫漂補償。"],
        ["dds-pf", "量測不同功率因數", "11.c2000_dds_dashboard/04_power_pf.html", "固定 V/I 峰值，只改 phase，記錄 P、PF 與波形相位。", "知道實功與視在功率的差別。", "用於 AC 電力計算與負載判讀。"],
        ["dds-jitter", "觀察過零抖動", "11.c2000_dds_dashboard/06_noise_jitter.html", "逐步提高 noise，再調 hysteresis，觀察 jitterCount。", "能判斷何時頻率量測開始不可信。", "對應電網頻率偵測與濾波設計。"],
        ["dds-cal", "完成量測校正整合任務", "11.c2000_dds_dashboard/07_calibration_lab.html", "調 offset、noise 與校正模式，讓整體判定 PASS。", "能交代校正策略與量測可信度。", "適合整理成電力量測實驗報告。"]
      ],
      faults: [
        ["RMS 明顯偏差", "硬體 offset 漂移但韌體仍固定扣 2048。", "切換校正模式，觀察 v_offset 與 Vrms 是否恢復。", "使用動態 offset 估測，並校準 ADC 中點。", "11.c2000_dds_dashboard/01_adc_offset.html"],
        ["頻率讀值跳動", "雜訊太大導致過零點抖動。", "看 jitterCount 與 ZCD 狀態是否頻繁變化。", "增加 hysteresis、濾波或改善類比前端雜訊。", "11.c2000_dds_dashboard/06_noise_jitter.html"],
        ["功率因數與預期不符", "電流相位方向定義、取樣同步或符號約定錯。", "改 phase 正負方向，確認 P 與 PF 的變化符合預期。", "統一電壓/電流方向定義並做已知負載校驗。", "11.c2000_dds_dashboard/04_power_pf.html"]
      ]
    }
  ];

  const glossary = [
    ["ADC", "Analog-to-Digital Converter，把類比電壓轉成數位 count。", "先確認輸入範圍、Vref、解析度與 offset。"],
    ["AFE", "Active Front End，可控的雙向 AC/DC 功率級。", "重點看相位、電流波形、THD 與閉迴路穩定度。"],
    ["Bode", "用頻率看系統增益與相位的圖。", "用來判斷頻寬、交越頻率與穩定裕度。"],
    ["CAN/UDS", "車用通訊與診斷服務。", "看到 7F/NRC 時先查 session/security/routine 條件。"],
    ["CCM", "Continuous Conduction Mode，電感電流不降到 0。", "Buck 常用設計區間，轉移關係較直觀。"],
    ["CPHA/CPOL", "SPI 的取樣相位與時鐘極性。", "Mode 錯時常見資料位移一位或亂碼。"],
    ["DAC", "Digital-to-Analog Converter，把數位碼轉成類比量。", "要同時檢查 code、Vref、輸出拓撲與校正。"],
    ["DCM", "Discontinuous Conduction Mode，電感電流降到 0。", "輕載常見，控制模型會改變。"],
    ["DDS", "Direct Digital Synthesis，用相位累加與查表產生可控波形。", "看頻率、表格點數、相位與 DAC/ADC 取樣同步。"],
    ["Duty", "PWM 高電位時間佔整個週期的比例。", "Buck 理想輸出約為 Vin × Duty。"],
    ["ESR", "電容等效串聯電阻。", "輸出漣波常由 ESR 和電容充放電兩部分組成。"],
    ["FAULT_LOCK", "故障鎖定狀態。", "安全系統不應默默自動復歸，要有明確條件。"],
    ["FIFO", "First-In First-Out 緩衝。", "讓 CPU/ISR/DMA 有時間處理高速資料。"],
    ["FOC", "Field-Oriented Control，把三相控制轉成 dq 軸控制。", "核心是 Clarke、Park、PI 與 SVPWM。"],
    ["Ki", "PI 控制器的積分增益。", "能消除穩態誤差，但太大會降低穩定度。"],
    ["Kp", "PI 控制器的比例增益。", "提高反應速度，但太大會震盪。"],
    ["LSB", "最小可分辨數位步階。", "ADC/DAC 解析度常用 LSB 評估。"],
    ["NRC", "UDS Negative Response Code，診斷拒絕原因。", "先解讀 NRC，再決定補 session、security 或條件。"],
    ["OCP", "Over Current Protection，過電流保護。", "實務上常由比較器或硬體閘極封鎖快速處理。"],
    ["Offset", "把訊號零點平移到 ADC 可讀範圍中間。", "雙向電流量測通常需要。"],
    ["PFC", "Power Factor Correction，讓輸入電流更接近與電壓同相的正弦。", "看 PF、THD、DC bus 與電流環品質。"],
    ["PI", "比例積分控制器。", "Kp 管即時反應，Ki 管長期誤差。"],
    ["PLL", "Phase-Locked Loop，追蹤外部交流相位的控制迴路。", "併網與 AFE 常用來取得穩定角度。"],
    ["PSFB", "Phase-Shift Full Bridge，相移全橋 DC-DC 拓撲。", "常搭配 ZVS 降低高壓高頻開關損耗。"],
    ["PWM", "Pulse Width Modulation，用開關占空比表示平均量。", "看 Duty、頻率、死區與濾波。"],
    ["Ripple", "電流或電壓的週期性紋波。", "Buck 設計先估電感 ΔI，再估電容 ΔV。"],
    ["RMS", "Root Mean Square，交流有效值。", "電力測量會用平方累積與週期平均估 Vrms/Irms。"],
    ["SOGI-PLL", "二階廣義積分器鎖相迴路。", "可產生正交訊號並讓 dq 軸追蹤電網相位。"],
    ["SPI", "同步序列通訊，SCLK/MOSI/MISO/CS 四條線常見。", "除錯先查接線與 Mode，再查 FIFO/Overrun。"],
    ["SVPWM", "Space Vector PWM，三相逆變器常用調變法。", "比 SPWM 有更高母線利用率，但有線性區邊界。"],
    ["THD", "Total Harmonic Distortion，總諧波失真。", "用來量化波形品質。"],
    ["ZVS", "Zero Voltage Switching，讓開關在近零電壓時切換。", "輕載時常因能量不足而失效，造成效率與溫升惡化。"],
    ["dead-time", "上下臂都關閉的安全間隔。", "防直通，但會造成低速電流畸變。"],
    ["dq", "跟著轉子旋轉的座標系。", "正確角度下，交流量會變成近似直流量。"],
    ["overrun", "接收資料來不及讀，緩衝被覆蓋。", "提高 FIFO、縮短 ISR 或改 DMA。"],
    ["過調變", "電壓命令超過 SVPWM 線性區。", "波形削頂，αβ 軌跡貼到六邊形。"],
    ["預充", "先用電阻替 DC bus 電容充電，再合主接觸器。", "避免接觸器閉合瞬間突波。"]
  ];

  global.CircuitCurriculum = { modules: modules, glossary: glossary };
})(window);
