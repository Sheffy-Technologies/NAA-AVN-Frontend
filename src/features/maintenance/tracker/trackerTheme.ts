/*
 * The maintenance tracker's look, taken from aircraft_maintenance_tracker_2.html
 * (its colour tokens, header, tab bar, cards, pills, meters, tables, buttons,
 * inputs and dialogs), scoped under `.mt` so it doesn't touch the rest of
 * the app. Dark mode follows the app theme through `data-theme` on the root.
 *
 * It sits in the `components` layer, so a Tailwind utility on an element
 * (e.g. `text-right`, `w-auto`) still wins over these defaults.
 */
export const TRACKER_CSS = `
@layer components {
.mt{--bg:#f5f6f8;--sf:#fff;--tx:#1b2430;--mu:#667085;--bd:#dfe3ea;--ac:#1d5fd1;--ok:#157347;--okb:#e3f4ea;--wa:#8a6100;--wab:#fff3d1;--so:#b34700;--sob:#ffe6d1;--ov:#b42318;--ovb:#fde4e1;--nd:#555;--ndb:#eceef2;
  background:var(--bg);color:var(--tx);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;border:1px solid var(--bd);border-radius:10px;overflow:hidden;color-scheme:light}
.mt[data-theme="dark"]{--bg:#10151c;--sf:#18202a;--tx:#e6eaf0;--mu:#93a0b3;--bd:#2a3442;--ac:#6ea2ff;--ok:#5fd394;--okb:#12301f;--wa:#f2c94c;--wab:#3a2f10;--so:#ffa766;--sob:#3d2410;--ov:#ff8a80;--ovb:#43181a;--nd:#aab;--ndb:#252d38;color-scheme:dark}
.mt *{box-sizing:border-box}

.mt-header{background:var(--sf);border-bottom:1px solid var(--bd);padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center}
.mt-header h1{font-size:20px;margin:0;font-weight:700;line-height:1.3}
.mt-header small{color:var(--mu);display:block;font-size:13px}
.mt-sp{flex:1}
.mt-nav{display:flex;gap:2px;padding:0 12px;background:var(--sf);border-bottom:1px solid var(--bd);overflow-x:auto}
.mt-nav button{background:none;border:0;border-bottom:3px solid transparent;padding:10px 12px;color:var(--mu);font:inherit;cursor:pointer;white-space:nowrap}
.mt-nav button:hover{color:var(--tx)}
.mt-nav button.on{color:var(--ac);border-color:var(--ac);font-weight:600}
.mt-main{padding:16px;max-width:1300px;margin:auto}

.mt-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px}
.mt-card{display:block;background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:12px 14px;color:var(--tx);text-align:left;font:inherit}
button.mt-card{cursor:pointer;width:100%}
button.mt-card:hover{border-color:var(--ac)}
.mt-card.sel{border-color:var(--ac)}
.mt-card > .k{display:block;color:var(--mu);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.mt-card > .v{display:block;font-size:22px;font-weight:700}
.mt-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px}
.mt h2{font-size:15px;margin:0 0 8px;font-weight:700}
.mt-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center}
.mt-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}

.mt-input{background:var(--sf);border:1px solid var(--bd);border-radius:6px;padding:6px 8px;max-width:100%;color:var(--tx);font:inherit;width:100%}
.mt-input:focus{outline:2px solid var(--ac);outline-offset:-1px}
.mt-input:disabled{opacity:.7}
.mt-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--ac);color:#fff;border:0;border-radius:6px;padding:7px 12px;cursor:pointer;font:inherit;white-space:nowrap}
.mt-btn.g{background:var(--sf);color:var(--tx);border:1px solid var(--bd)}
.mt-btn.r{background:var(--ov);color:#fff}
.mt[data-theme="dark"] .mt-btn.r{color:#1b0000}
.mt-btn.sm{padding:2px 8px;font-size:12px}
.mt-btn:disabled{opacity:.5;cursor:default}
.mt-link{background:none;border:0;padding:0;color:var(--ac);cursor:pointer;font:inherit;text-decoration:none}
.mt-x{background:none;border:0;padding:0 2px;color:var(--ov);cursor:pointer;font-weight:700;font-size:15px}

.mt-tw{overflow-x:auto;background:var(--sf);border:1px solid var(--bd);border-radius:10px}
.mt-tw table{border-collapse:collapse;width:100%;min-width:860px;font-size:14px}
.mt-tw th,.mt-tw td{padding:7px 10px;text-align:left;border-bottom:1px solid var(--bd);vertical-align:middle}
.mt-tw th{font-size:11px;text-transform:uppercase;color:var(--mu);letter-spacing:.04em;background:var(--bg);position:sticky;top:0;font-weight:600;white-space:nowrap}
.mt-tw .n{text-align:right;font-variant-numeric:tabular-nums}
.mt-tw td.q.z{color:var(--mu)}
.mt-tw tr.gh td{background:var(--bg);font-weight:600;color:var(--mu)}
.mt-tw tbody tr.click{cursor:pointer}
.mt-tw tbody tr.click:hover{background:var(--bg)}
.mt-tw td .mt-input{padding:4px 6px}

.mt-sub{color:var(--mu);font-size:12px}
.mt-pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:12px;font-weight:600;white-space:nowrap;border:0}
.mt-pill.ok,.mt-pill.done{background:var(--okb);color:var(--ok)}
.mt-pill.watch{background:var(--wab);color:var(--wa)}
.mt-pill.soon{background:var(--sob);color:var(--so)}
.mt-pill.over{background:var(--ovb);color:var(--ov)}
.mt-pill.nodata,.mt-pill.cond,.mt-pill.daily{background:var(--ndb);color:var(--nd)}
.mt-pill.wob{background:var(--sob);color:var(--so);cursor:pointer}
.mt-meter{height:6px;background:var(--ndb);border-radius:3px;min-width:60px;overflow:hidden}
.mt-meter i{display:block;height:100%}
.mt-meter.m-ok i{background:var(--ok)}.mt-meter.m-watch i{background:var(--wa)}.mt-meter.m-soon i{background:var(--so)}.mt-meter.m-over i{background:var(--ov)}

.mt-box{border:1px dashed var(--bd);border-radius:8px;padding:8px 10px;margin-top:12px}
.mt-empty{padding:24px;text-align:center;color:var(--mu)}
ul.mt-l{list-style:none;margin:0;padding:0}
ul.mt-l li{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bd);cursor:pointer}
ul.mt-l li:last-child{border:0}

.mt-mask{position:fixed;inset:0;background:#0008;display:flex;align-items:flex-start;justify-content:center;padding:20px 12px;overflow:auto;z-index:50}
.mt-modal{background:var(--sf);color:var(--tx);border-radius:12px;padding:18px;width:100%;max-width:520px;border:1px solid var(--bd)}
.mt-modal.wide{max-width:680px}
.mt-modal h2{margin-bottom:4px}
.mt-label{display:block;margin:8px 0 2px;font-size:12px;color:var(--mu)}
.mt-modal .mt-row{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;align-items:center}
}
`;
