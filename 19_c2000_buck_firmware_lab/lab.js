(() => {
  "use strict";
  const Hil = window.C2000BuckHil;
  if (!Hil) return;

  const $ = selector => document.querySelector(selector);
  const scenarioButtons = [...document.querySelectorAll("[data-scenario]")];
  const faultNames = [
    [Hil.FAULT.OCP, "OCP"],
    [Hil.FAULT.OVP, "OVP"],
    [Hil.FAULT.SENSOR, "SENSOR"],
    [Hil.FAULT.COMMAND_TIMEOUT, "COMMAND_TIMEOUT"]
  ];

  function render(result) {
    $("#hilScenario").textContent = result.name;
    $("#hilPass").textContent = result.pass ? "PASS" : "FAIL";
    $("#hilPass").dataset.pass = result.pass ? "1" : "0";
    $("#hilVout").textContent = `${result.vout.toFixed(2)} V`;
    $("#hilDuty").textContent = `${(result.duty * 100).toFixed(1)} %`;
    $("#hilState").textContent = result.state;
    $("#hilLatency").textContent = result.tripLatencyTicks == null ? "—" : `${result.tripLatencyTicks} tick`;
    const active = faultNames.filter(([mask]) => result.faultLatch & mask).map(([, name]) => name);
    $("#hilFault").textContent = active.length ? active.join(" | ") : "NONE";

    $("#hilTrace").innerHTML = result.trace.slice(-12).map(row => `
      <tr>
        <td>${row.tick}</td>
        <td>${row.vout.toFixed(2)}</td>
        <td>${row.iL.toFixed(2)}</td>
        <td>${(row.duty * 100).toFixed(1)}%</td>
        <td>${row.state}</td>
      </tr>`).join("");
  }

  scenarioButtons.forEach(button => {
    button.addEventListener("click", () => {
      scenarioButtons.forEach(item => item.classList.toggle("selected", item === button));
      render(Hil.runScenario(button.dataset.scenario));
    });
  });

  const evidence = Hil.boardEvidenceContract();
  $("#boardEvidence").innerHTML = evidence.map(item => `
    <label class="evidence-slot">
      <input type="checkbox" data-evidence="${item.id}">
      <span><b>${item.signal}</b><small>${item.criterion}</small></span>
    </label>`).join("");

  $("#boardEvidence").addEventListener("change", () => {
    const checked = document.querySelectorAll("[data-evidence]:checked").length;
    $("#evidenceCount").textContent = `${checked}/${evidence.length}`;
  });

  render(Hil.runScenario("nominal"));
})();
