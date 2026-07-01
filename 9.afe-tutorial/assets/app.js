(function () {
    const storage = {
        read(key, fallback) {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : fallback;
            } catch (error) {
                return fallback;
            }
        },
        write(key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        }
    };

    function activateNav() {
        const current = location.pathname.split("/").pop() || "index.html";
        document.querySelectorAll("[data-nav]").forEach((link) => {
            const target = link.getAttribute("href");
            if (target === current) link.classList.add("is-active");
        });
    }

    function setupChecklist() {
        document.querySelectorAll("[data-checklist]").forEach((list) => {
            const key = `afe-checklist:${list.dataset.checklist}`;
            const saved = storage.read(key, {});

            list.querySelectorAll("input[type='checkbox']").forEach((box, index) => {
                box.checked = Boolean(saved[index]);
                box.addEventListener("change", () => {
                    saved[index] = box.checked;
                    storage.write(key, saved);
                });
            });
        });
    }

    function setupGlossarySearch() {
        const input = document.querySelector("[data-glossary-search]");
        const terms = Array.from(document.querySelectorAll("[data-term]"));
        if (!input || terms.length === 0) return;

        input.addEventListener("input", () => {
            const q = input.value.trim().toLowerCase();
            terms.forEach((term) => {
                const text = term.textContent.toLowerCase();
                term.hidden = q.length > 0 && !text.includes(q);
            });
        });
    }

    function setupScenarioFill() {
        document.querySelectorAll("[data-scenario]").forEach((button) => {
            button.addEventListener("click", () => {
                const data = JSON.parse(button.dataset.scenario);
                for (const [name, value] of Object.entries(data)) {
                    const field = document.querySelector(`[name='${name}']`);
                    if (field) field.value = value;
                }
            });
        });
    }

    function renderRecords(records) {
        const output = document.querySelector("[data-records]");
        if (!output) return;

        output.innerHTML = "";
        if (records.length === 0) {
            output.innerHTML = "<p class='muted'>目前尚無紀錄。</p>";
            return;
        }

        records.slice().reverse().forEach((item) => {
            const node = document.createElement("article");
            node.className = "record";
            node.innerHTML = `
                <strong>${item.scenario}</strong>
                <div class="muted">${item.date}</div>
                <div>模式: ${item.mode} | 負載: ${item.loadKw} kW | THD: ${item.thd}% | 相位: ${item.phaseDeg} deg</div>
                <div>${item.observation}</div>
            `;
            output.appendChild(node);
        });
    }

    function setupLabRecords() {
        const form = document.querySelector("#lab-record-form");
        if (!form) return;

        const key = "afe-lab-records";
        let records = storage.read(key, []);
        renderRecords(records);

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const record = {
                date: new Date().toLocaleString("zh-TW"),
                scenario: data.get("scenario") || "未命名實驗",
                mode: data.get("mode") || "auto",
                loadKw: data.get("loadKw") || "",
                thd: data.get("thd") || "",
                phaseDeg: data.get("phaseDeg") || "",
                observation: data.get("observation") || "未填寫觀察"
            };
            records.push(record);
            storage.write(key, records);
            renderRecords(records);
            form.reset();
        });

        const clear = document.querySelector("[data-clear-records]");
        if (clear) {
            clear.addEventListener("click", () => {
                records = [];
                storage.write(key, records);
                renderRecords(records);
            });
        }

        const exportButton = document.querySelector("[data-export-records]");
        if (exportButton) {
            exportButton.addEventListener("click", () => {
                const header = ["date", "scenario", "mode", "loadKw", "thd", "phaseDeg", "observation"];
                const rows = records.map((record) => header.map((field) => `"${String(record[field] || "").replaceAll('"', '""')}"`).join(","));
                const csv = [header.join(","), ...rows].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "afe-lab-records.csv";
                link.click();
                URL.revokeObjectURL(url);
            });
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        activateNav();
        setupChecklist();
        setupGlossarySearch();
        setupScenarioFill();
        setupLabRecords();
        if (window.lucide) window.lucide.createIcons();
    });
})();
