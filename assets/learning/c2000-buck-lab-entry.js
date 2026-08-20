(function (global) {
  "use strict";
  const Learning = global.CircuitLearning;
  if (!Learning || !Learning.renderHome) return;
  const previous = Learning.renderHome;

  Learning.renderHome = function renderHomeWithC2000Lab(rootId) {
    previous(rootId);
    const root = document.getElementById(rootId);
    const journey = root && root.querySelector(".journey-shell");
    if (!journey || root.querySelector("[data-c2000-buck-lab-entry]")) return;

    journey.insertAdjacentHTML("afterend", `
      <section class="panel" data-c2000-buck-lab-entry style="margin:1.25rem 0">
        <div class="eyebrow">EXECUTABLE POWER FIRMWARE LAB</div>
        <h2 style="margin-top:.35rem">C2000 Buck：從 C(z) 到 driverlib、HIL、Trip Zone evidence</h2>
        <p class="muted">不是只看 peripheral mapping：同一份控制 contract 會進 host SIL、deterministic HIL，再對到 ePWM / ADC / CMPSS / Digital Compare / Trip Zone。</p>
        <a class="button primary" href="19_c2000_buck_firmware_lab/index.html">進入 C2000 Buck Firmware Lab →</a>
      </section>`);
  };
})(window);
