import fs from "node:fs/promises";

const tabs = await (await fetch("http://127.0.0.1:9227/json/list")).json();
const ws = new WebSocket(
  tabs.find((t) => t.type === "page").webSocketDebuggerUrl,
);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map(),
  errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(m.error) : p.resolve(m.result);
  }
  if (m.method === "Runtime.exceptionThrown")
    errors.push(m.params.exceptionDetails);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const seq = ++id;
    pending.set(seq, { resolve, reject });
    ws.send(JSON.stringify({ id: seq, method, params }));
  });
await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 430,
  height: 932,
  deviceScaleFactor: 1,
  mobile: true,
});
if (process.argv.includes("--navigate")) {
  await send("Page.navigate", { url: "http://127.0.0.1:3000/#procurement" });
  await new Promise((r) => setTimeout(r, 4500));
}
// Vite may be reloading after a source edit; never accept a blank loading page.
for (let attempt = 0; attempt < 40; attempt++) {
  const ready = await send("Runtime.evaluate", { expression: '!!document.querySelector(".table-viewport canvas") && !document.querySelector(".load-message")', returnByValue: true });
  if (ready.result.value) break;
  if (attempt === 39) throw new Error("Pinball did not finish loading");
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (process.argv.includes("--launch")) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: " ",
    code: "Space",
    windowsVirtualKeyCode: 32,
  });
  await new Promise((r) => setTimeout(r, 800));
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: " ",
    code: "Space",
    windowsVirtualKeyCode: 32,
  });
  await new Promise((r) => setTimeout(r, 1800));
}
if (process.argv.includes("--pull")) {
  const result = await send("Runtime.evaluate", {
    expression:
      '(()=>{const r=document.querySelector(".plunger-hint").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2+28};})()',
    returnByValue: true,
  });
  const p = result.result.value;
  await send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...p, id: 1 }],
  });
  for (let i = 1; i <= 6; i++) {
    await send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: p.x, y: p.y + i * 7, id: 1 }],
    });
    await new Promise((r) => setTimeout(r, 50));
  }
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await new Promise((r) => setTimeout(r, 500));
  const launched = await send("Runtime.evaluate", {
    expression: 'document.querySelector("[data-readout=status]").textContent',
    returnByValue: true,
  });
  if (!launched.result.value.includes("Requirement filed"))
    throw new Error("Pull-down plunger failed to launch");
  console.log("PASS: touch plunger pull/release");
}
if (process.argv.includes("--flip")) {
  for (let i = 0; i < 8; i++) {
    for (const key of ["a", "d"])
      await send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code: key === "a" ? "KeyA" : "KeyD",
      });
    await new Promise((r) => setTimeout(r, 160));
    for (const key of ["a", "d"])
      await send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key,
        code: key === "a" ? "KeyA" : "KeyD",
      });
    await new Promise((r) => setTimeout(r, 200));
  }
}
if (process.argv.includes("--play")) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "F2",
    code: "F2",
  });
  for (let i = 0; i < 30; i++) {
    const state = await send("Runtime.evaluate", {
      expression: 'document.querySelector(".debug-readout")?.textContent',
      returnByValue: true,
    });
    if (i % 5 === 0) console.log("play", i, state.result?.value);
    if ((state.result?.value ?? "").startsWith("ready")) {
      await send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: " ",
        code: "Space",
      });
      await new Promise((r) => setTimeout(r, 500));
      await send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: " ",
        code: "Space",
      });
    }
    for (const key of ["a", "d"])
      await send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code: key === "a" ? "KeyA" : "KeyD",
      });
    await new Promise((r) => setTimeout(r, 150));
    for (const key of ["a", "d"])
      await send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key,
        code: key === "a" ? "KeyA" : "KeyD",
      });
    await new Promise((r) => setTimeout(r, 200));
  }
  const budget = await send("Runtime.evaluate", {
    expression: 'document.querySelector("[data-readout=budget]")?.textContent',
    returnByValue: true,
  });
  if (budget.result?.value === "$0")
    throw new Error("Browser gameplay did not earn any contract value");
}
if (process.argv.includes("--checks")) {
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const click = async (selector) => {
    const rect = await evaluate(
      `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...rect,
      button: "left",
      clickCount: 1,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...rect,
      button: "left",
      clickCount: 1,
    });
    await new Promise((r) => setTimeout(r, 150));
  };
  await click("[data-action=pause]");
  if (
    !(await evaluate(
      'document.querySelector(".machine-dialog").innerText.includes("recess")',
    ))
  )
    throw new Error("Pause dialog missing");
  await click(".dialog-card button");
  if (!(await evaluate('document.querySelector(".machine-dialog").hidden')))
    throw new Error("Resume failed");
  const rects = await evaluate(
    '(()=>{const r=document.querySelector(".table-viewport").getBoundingClientRect();return [.3,.7].map(x=>({x:r.x+r.width*x,y:r.y+r.height*.76}));})()',
  );
  await send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: rects.map((r, i) => ({ ...r, id: i + 1 })),
  });
  await new Promise((r) => setTimeout(r, 200));
  if (
    !(await evaluate(
      '["left","right"].every(c=>document.querySelector(".procurement-machine").classList.contains(`${c}-held`))',
    ))
  )
    throw new Error("Simultaneous flippers failed");
  await send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await new Promise((r) => setTimeout(r, 200));
  if (
    await evaluate(
      'document.querySelector(".procurement-machine").matches(".left-held,.right-held")',
    )
  )
    throw new Error("Touch cancellation left a held control");
  await click("[data-action=authorize]");
  if (
    !(await evaluate(
      'document.querySelector(".machine-dialog").innerText.includes("Rubber-stamped")',
    ))
  )
    throw new Error("Authorization confirmation missing");
  await click(".dialog-card button");
  await new Promise((r) => setTimeout(r, 1000));
  if (await evaluate('!!document.querySelector(".procurement-machine")'))
    throw new Error("3D canvas survived return to campaign");
  console.log(
    "PASS: pause/resume, simultaneous flippers, touch cancellation, authorization, campaign return and DOM cleanup",
  );
}
console.log(
  JSON.stringify(
    await send("Runtime.evaluate", {
      expression: "document.body.innerText",
      returnByValue: true,
    }),
    null,
    2,
  ),
);
console.log("Errors", JSON.stringify(errors));
const shot = await send("Page.captureScreenshot", { format: "png" });
const output =
  process.argv.find((x) => x.startsWith("--output="))?.slice(9) ??
  "/tmp/pinball-current.png";
await fs.writeFile(output, Buffer.from(shot.data, "base64"));
console.log(output);
ws.close();
