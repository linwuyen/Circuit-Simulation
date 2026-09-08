globalThis.CircuitLearningGlossary = { '導通比例（Duty）':'一輪中開關導通的時間比例。25% 表示每 4 份時間有 1 份導通。','PWM：用脈衝寬度控制':'以開關導通多久來傳遞控制命令。','ADC：把電壓轉成數字':'控制器讀到的是量測轉換後的數字；感測或換算出錯，就可能判斷錯誤。','電感 L 與電容 C':'電感儲存磁場能量，電流不能瞬間改變；電容儲存電場能量，電壓不能瞬間改變（理想元件、有限激勵）。','負載 R':'消耗電能的部分。本課用電阻表示；同電壓下電阻越大，需求電流越小。','CCM／DCM：電流是否中斷':'CCM：每輪電感電流都維持正值。DCM：每輪有一段電流停在零。本課限二極體降壓。','ISR：中斷發生後執行的程式':'例如取樣完成後，處理量測並計算控制命令。程式算完不代表硬體已更新。','PI：依誤差調整控制':'P 看現在差多少，I 累積一段時間的誤差。本課先理解物理，進階課再調整控制器。','微秒（µs）、微亨利（µH）':'微表示百萬分之一；1 µs = 0.000001 秒。µH 是電感的單位，不是時間。','ESR／DCR：元件也有電阻':'ESR 是電容等效串聯電阻；DCR 是電感繞線的直流電阻。進階模型才加入這些非理想因素。'};

globalThis.CircuitLearningTermAliases = Object.fromEntries(['ADC','PWM','ISR','PI','ESR','DCR','CCM','DCM','Duty'].map(term => {
 const key = Object.keys(globalThis.CircuitLearningGlossary).find(k => k.includes(term));
 return [term, globalThis.CircuitLearningGlossary[key]];
}));
