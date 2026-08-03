import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { ensureDir } from './lib/files.mjs';

const root = process.cwd();
const iconSource = path.join(root, 'assets-src/icon.svg');
const iconSvg = await readFile(iconSource, 'utf8');
const iconData = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`;
await ensureDir(path.join(root, 'assets'));
await ensureDir(path.join(root, 'store-assets/screenshots/en'));
await ensureDir(path.join(root, 'store-assets/screenshots/ru'));

for (const size of [16, 32, 48, 128]) {
  const result = spawnSync('/opt/imagemagick/bin/magick', [iconSource, '-background', 'none', '-resize', `${size}x${size}`, path.join(root, `assets/icon${size}.png`)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`ImageMagick failed for icon${size}.png: ${result.stderr}`);
}
await writeFile(path.join(root, 'store-assets/store-icon-128.png'), await readFile(path.join(root, 'assets/icon128.png')));

const css = `
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#0b1220;background:#eef4ff}.canvas{position:relative;width:100vw;height:100vh;overflow:hidden;background:radial-gradient(circle at 10% 5%,rgba(59,130,246,.24),transparent 32%),radial-gradient(circle at 94% 8%,rgba(20,184,166,.18),transparent 28%),linear-gradient(145deg,#f8fbff,#eef4ff 55%,#e7f2f8)}.canvas:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(37,99,235,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,.045) 1px,transparent 1px);background-size:40px 40px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.65),transparent 78%)}.copy{position:absolute;z-index:3;left:64px;top:48px;max-width:570px}.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.82);border:1px solid rgba(148,163,184,.35);box-shadow:0 8px 28px rgba(15,23,42,.07);font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#1d4ed8}.eyebrow:before{content:"";width:7px;height:7px;border-radius:50%;background:#14b8a6;box-shadow:0 0 0 4px rgba(20,184,166,.13)}h1{margin:18px 0 9px;font-size:42px;line-height:1.04;letter-spacing:-.045em;max-width:700px}p.lead{margin:0;color:#53647c;font-size:18px;line-height:1.48;max-width:620px}.browser{position:absolute;z-index:2;background:#fff;border:1px solid rgba(148,163,184,.5);border-radius:18px;overflow:hidden;box-shadow:0 28px 80px rgba(15,23,42,.2)}.browserbar{height:42px;background:#f7f9fc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;padding:0 14px}.dot{width:9px;height:9px;border-radius:50%;background:#cbd5e1}.address{margin-left:8px;height:25px;min-width:300px;display:flex;align-items:center;padding:0 12px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;color:#64748b;font-size:11px}.chatapp{display:grid;grid-template-columns:188px 1fr;height:calc(100% - 42px);background:#f6f8fb}.sidebar{padding:16px 12px;border-right:1px solid #e2e8f0;background:#f8fafc}.side-title{font-weight:800;font-size:13px;margin:0 0 14px 6px}.chatitem{display:flex;gap:9px;align-items:center;padding:9px;border-radius:9px;color:#475569;font-size:11px}.chatitem.active{background:#e8f0ff;color:#1e3a8a;font-weight:700}.avatar{width:26px;height:26px;border-radius:9px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);display:grid;place-items:center;font-weight:800;color:#1d4ed8}.thread{position:relative;background:#fff}.threadhead{height:48px;padding:0 18px;border-bottom:1px solid #e6ebf2;display:flex;align-items:center;font-size:13px;font-weight:800}.messages{padding:18px 22px;display:flex;flex-direction:column;gap:12px}.msg{max-width:74%;padding:10px 12px;border-radius:12px 12px 12px 3px;background:#f1f5f9;font-size:11px;line-height:1.42;color:#334155;box-shadow:0 1px 0 rgba(15,23,42,.05)}.msg.me{align-self:flex-end;border-radius:12px 12px 3px 12px;background:#e7efff;color:#1e3a8a}.msg b{display:block;margin-bottom:3px;font-size:10px}.filechip{display:flex;align-items:center;gap:8px;margin-top:7px;padding:7px;border-radius:8px;background:#fff;border:1px solid #dfe7f1}.fileicon{width:25px;height:30px;border-radius:5px;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:8px;font-weight:900}.popup{position:absolute;width:360px;background:#fff;border:1px solid #dce4ee;border-radius:16px;box-shadow:0 26px 70px rgba(15,23,42,.27);padding:20px;color:#0b1220}.brand{display:flex;align-items:center;gap:12px;margin-bottom:17px}.brand img{width:42px;height:42px;border-radius:11px;box-shadow:0 8px 20px rgba(37,99,235,.22)}.brandname{font-size:16px;font-weight:830;line-height:1.1}.brandsub{font-size:11px;color:#64748b;margin-top:4px}.card{border:1px solid #dce4ee;border-radius:14px;background:#f4f7fb;padding:15px}.status{display:flex;gap:10px}.check{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:rgba(20,184,166,.14);color:#0f9f91;font-size:12px;font-weight:900}.status b{font-size:12px}.status small{display:block;color:#64748b;font-size:10px;margin-top:3px}.toggleline{display:flex;align-items:center;font-size:11px;font-weight:720;margin:15px 0}.toggle{margin-left:auto;width:38px;height:22px;border-radius:999px;background:#2563eb;position:relative}.toggle:after{content:"";position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;right:3px;top:3px;box-shadow:0 1px 4px rgba(15,23,42,.22)}.button{height:41px;border-radius:10px;background:#2563eb;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:800;box-shadow:0 9px 19px rgba(37,99,235,.2)}.local{display:flex;justify-content:center;align-items:center;gap:6px;color:#64748b;font-size:10px;margin-top:13px}.local:before{content:"";width:7px;height:7px;border-radius:50%;background:#14b8a6;box-shadow:0 0 0 4px rgba(20,184,166,.11)}.overlay{position:absolute;width:420px;background:#fff;border:1px solid #dce4ee;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.28);overflow:hidden}.overlayhead{height:56px;display:flex;align-items:center;gap:11px;padding:0 16px;background:linear-gradient(180deg,#f8fbff,#f3f7fc);border-bottom:1px solid #e5ebf2}.miniicon{width:30px;height:30px;border-radius:9px;background:#2563eb;position:relative}.miniicon:after{content:"↓";position:absolute;right:-4px;bottom:-5px;width:17px;height:17px;border-radius:6px;background:#14b8a6;color:white;display:grid;place-items:center;font-size:11px;font-weight:900;border:2px solid white}.overlaytitle{font-size:13px;font-weight:820}.bar{height:5px;background:#e9eef5}.bar i{display:block;width:68%;height:100%;background:linear-gradient(90deg,#2563eb,#14b8a6)}.phase{font-size:13px;font-weight:780;padding:14px 16px 4px}.progresscopy{font-size:11px;color:#64748b;padding:0 16px 10px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:0 16px 13px}.stat{background:#f4f7fb;border:1px solid #e7edf5;border-radius:10px;padding:8px}.stat b{display:block;font-size:13px}.stat span{font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}.cancel{margin:0 16px 14px auto;width:102px;height:31px;border:1px solid #cbd5e1;border-radius:8px;display:grid;place-items:center;font-size:10px;font-weight:760}.zipwindow{background:#fff;border:1px solid rgba(148,163,184,.48);border-radius:18px;box-shadow:0 28px 80px rgba(15,23,42,.18);overflow:hidden}.ziphead{height:52px;display:flex;align-items:center;gap:12px;padding:0 18px;border-bottom:1px solid #e7ecf2;font-size:13px;font-weight:820}.zipbody{display:grid;grid-template-columns:1fr 1.15fr;height:calc(100% - 52px)}.tree{padding:20px;border-right:1px solid #e7ecf2;background:#f8fafc;font-size:12px;line-height:2;color:#475569}.tree b{color:#0b1220}.tree .indent{padding-left:22px}.report{padding:20px}.report h3{font-size:14px;margin:0 0 12px}.row{display:grid;grid-template-columns:18px 1fr 66px;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #edf1f6;font-size:11px}.okdot{width:16px;height:16px;border-radius:50%;background:#dcfce7;color:#16a34a;display:grid;place-items:center;font-size:9px;font-weight:900}.faildot{background:#fee2e2;color:#dc2626}.badge{justify-self:end;padding:4px 7px;border-radius:999px;background:#e8faf6;color:#087f6f;font-size:8px;font-weight:800}.formatgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.format{background:#fff;border:1px solid rgba(148,163,184,.48);border-radius:18px;box-shadow:0 20px 60px rgba(15,23,42,.14);overflow:hidden}.formathead{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid #e7ecf2}.fmticon{width:38px;height:43px;border-radius:8px;display:grid;place-items:center;font-size:10px;font-weight:900}.format h3{font-size:15px;margin:0}.format small{color:#64748b}.code{margin:0;padding:17px 18px;background:#0b1220;color:#dbeafe;font:10px/1.55 ui-monospace,monospace;height:190px;white-space:pre-wrap}.htmlpreview{padding:17px;height:190px}.htmlmsg{padding:10px;border-left:3px solid #2563eb;background:#f4f7fb;border-radius:5px;font-size:10px;margin-bottom:8px}.flow{display:flex;align-items:center;justify-content:center;gap:24px}.flowcard{width:225px;height:190px;background:#fff;border:1px solid rgba(148,163,184,.5);border-radius:19px;box-shadow:0 22px 58px rgba(15,23,42,.13);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:22px}.flowcard img{width:66px;height:66px;border-radius:18px;margin-bottom:13px}.flowcard h3{font-size:15px;margin:0 0 6px}.flowcard p{font-size:10px;color:#64748b;margin:0;line-height:1.4}.arrow{font-size:30px;color:#2563eb;font-weight:900}.cloud{position:relative;width:160px;height:112px;display:grid;place-items:center;color:#94a3b8;font-size:12px}.cloudshape{position:absolute;width:120px;height:58px;border:3px solid #cbd5e1;border-radius:999px;background:rgba(255,255,255,.75)}.cloudshape:before,.cloudshape:after{content:"";position:absolute;background:#fff;border:3px solid #cbd5e1;border-bottom:0;border-radius:999px 999px 0 0}.cloudshape:before{width:52px;height:36px;left:18px;top:-27px}.cloudshape:after{width:42px;height:28px;right:11px;top:-19px}.slash{position:absolute;width:150px;height:6px;background:#dc2626;border-radius:5px;transform:rotate(-35deg);box-shadow:0 0 0 5px rgba(255,255,255,.8)}.privacyline{position:absolute;left:50%;transform:translateX(-50%);bottom:48px;font-size:13px;font-weight:800;color:#087f6f;background:#e8faf6;border:1px solid #c7efe6;border-radius:999px;padding:9px 15px}.promo{display:flex;align-items:center;height:100%;padding:32px;background:radial-gradient(circle at 95% 5%,rgba(20,184,166,.32),transparent 38%),linear-gradient(145deg,#0b1220,#122445 58%,#16365a);color:#fff}.promo img{width:76px;height:76px;border-radius:21px;box-shadow:0 20px 40px rgba(0,0,0,.28);margin-right:22px}.promo h1{font-size:27px;margin:0 0 7px;letter-spacing:-.035em}.promo p{margin:0;color:#c9d8ed;font-size:14px}.promo .pill{display:inline-flex;margin-top:14px;padding:6px 9px;border:1px solid rgba(255,255,255,.2);border-radius:999px;color:#8ee7d7;font-size:9px;font-weight:800;letter-spacing:.07em}.marquee{height:100%;display:grid;grid-template-columns:1fr 1.05fr;align-items:center;padding:58px 72px;background:radial-gradient(circle at 90% 4%,rgba(20,184,166,.30),transparent 34%),linear-gradient(145deg,#0b1220,#11284c 58%,#17476a);color:#fff}.marquee h1{font-size:54px;margin:0 0 16px;max-width:600px}.marquee p{color:#cbd8ea;font-size:19px;max-width:520px}.pack{position:relative;height:390px}.packbox{position:absolute;left:80px;right:10px;bottom:10px;height:190px;border:3px solid #2dd4bf;border-radius:24px;background:linear-gradient(145deg,#164e63,#0f3d56);box-shadow:0 30px 70px rgba(0,0,0,.28)}.packlid{position:absolute;left:55px;right:35px;bottom:175px;height:70px;border:3px solid #5eead4;border-radius:24px 24px 9px 9px;background:#155e75;transform:perspective(500px) rotateX(48deg);transform-origin:bottom}.packcard{position:absolute;width:130px;height:175px;border-radius:16px;background:#fff;color:#0b1220;box-shadow:0 20px 50px rgba(0,0,0,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900}.packcard span{font-size:11px;color:#64748b;margin-top:7px}.c1{left:88px;top:53px;transform:rotate(-8deg)}.c2{left:230px;top:25px;transform:rotate(3deg)}.c3{left:370px;top:64px;transform:rotate(9deg)}
`;

function chatSidebar() {
  return `<aside class="sidebar"><p class="side-title">Chats</p><div class="chatitem active"><span class="avatar">AC</span>Alex & Casey</div><div class="chatitem"><span class="avatar">P</span>Project launch</div><div class="chatitem"><span class="avatar">D</span>Design review</div></aside>`;
}
function messageThread() {
  return `<section class="thread"><div class="threadhead">Alex & Casey</div><div class="messages"><div class="msg"><b>Alex · 10:42</b>Here is the signed brief and the final dashboard.</div><div class="msg me"><b>You · 10:45</b>Perfect. I’ll archive the whole conversation with the files.</div><div class="msg"><b>Alex · 10:46</b><div class="filechip"><span class="fileicon">PDF</span><span><strong>Project brief.pdf</strong><br><small>2.4 MB</small></span></div></div><div class="msg"><b>Casey · 10:50</b>The older messages are above — there are almost two years of history.</div></div></section>`;
}
function popup(language = 'en') {
  const t = language === 'ru' ? { title:'Экспорт чата', sub:'Файлы и сообщения в одном ZIP', detected:'Чат найден', current:'Alex & Casey', include:'Включить доступные файлы', button:'Экспортировать чат в ZIP', local:'Обработка только на устройстве' } : { title:'Chat Exporter', sub:'Messages and files in one ZIP', detected:'Chat detected', current:'Alex & Casey', include:'Include accessible files', button:'Export chat to ZIP', local:'Processed locally on this device' };
  return `<div class="popup"><div class="brand"><img src="${iconData}" alt=""><div><div class="brandname">${t.title}</div><div class="brandsub">${t.sub}</div></div></div><div class="card"><div class="status"><span class="check">✓</span><div><b>${t.detected}</b><small>${t.current}</small></div></div><div class="toggleline">${t.include}<span class="toggle"></span></div><div class="button">${t.button}</div></div><div class="local">${t.local}</div></div>`;
}
function baseCanvas(title, subtitle, scene, language = 'en') {
  const eyebrow = language === 'ru' ? 'ЛОКАЛЬНО · БЕЗ ПРАВ АДМИНА' : 'LOCAL-FIRST · NO ADMIN ACCESS';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="canvas"><div class="copy"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p class="lead">${subtitle}</p></div>${scene}</div></body></html>`;
}
function screenshot1(language = 'en') {
  const ru = language === 'ru';
  return baseCanvas(ru ? 'Экспортируйте чат Teams в один ZIP' : 'Export a Teams chat to one ZIP', ru ? 'Сообщения, ссылки, изображения и доступные файлы — готовый переносимый архив.' : 'Messages, links, images and accessible files in one portable archive.', `<div class="browser" style="left:64px;right:64px;top:220px;bottom:34px"><div class="browserbar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><div class="address">🔒 teams.cloud.microsoft</div></div><div class="chatapp">${chatSidebar()}${messageThread()}</div>${popup(language).replace('class="popup"','class="popup" style="right:24px;top:72px"')}</div>`, language);
}
function screenshot2(language = 'en') {
  const ru = language === 'ru';
  const overlay = `<div class="overlay" style="right:30px;bottom:28px"><div class="overlayhead"><span class="miniicon"></span><span class="overlaytitle">${ru ? 'Экспорт чата' : 'Chat Exporter'}</span></div><div class="bar"><i></i></div><div class="phase">${ru ? 'Загружаю историю чата' : 'Loading chat history'}</div><div class="progresscopy">${ru ? 'Шаг 146 · найдено более ранних сообщений' : 'Step 146 · earlier messages found'}</div><div class="stats"><div class="stat"><b>1,842</b><span>${ru ? 'сообщения' : 'messages'}</span></div><div class="stat"><b>52</b><span>${ru ? 'вложения' : 'attachments'}</span></div><div class="stat"><b>187 MB</b><span>${ru ? 'загружено' : 'downloaded'}</span></div></div><div class="cancel">${ru ? 'Отменить' : 'Cancel export'}</div></div>`;
  return baseCanvas(ru ? 'Длинный чат? История загрузится автоматически.' : 'Long chat? History loads automatically.', ru ? 'Расширение сохраняет каждую виртуализированную порцию сообщений и показывает честный прогресс.' : 'The extension preserves every virtualized message batch and shows honest progress.', `<div class="browser" style="left:64px;right:64px;top:218px;bottom:34px"><div class="browserbar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><div class="address">🔒 teams.cloud.microsoft</div></div><div class="chatapp">${chatSidebar()}${messageThread()}</div>${overlay}</div>`, language);
}
function screenshot3() {
  return baseCanvas('Messages + accessible files', 'Every discovered file receives a downloaded, skipped or failed status — never a silent omission.', `<div class="zipwindow" style="position:absolute;left:64px;right:64px;top:230px;bottom:44px"><div class="ziphead"><img src="${iconData}" style="width:30px;height:30px;border-radius:8px">teams-chat-Alex-Casey-2026-08-02.zip</div><div class="zipbody"><div class="tree"><b>📦 chat export</b><div class="indent">📄 chat.html</div><div class="indent">{ } chat.json</div><div class="indent">▦ chat.csv</div><div class="indent">🔗 links.csv</div><div class="indent"><b>📁 attachments/</b></div><div class="indent" style="padding-left:44px">📕 001_Project brief.pdf</div><div class="indent" style="padding-left:44px">📘 002_Roadmap.docx</div><div class="indent" style="padding-left:44px">🖼 003_dashboard.png</div><div class="indent">📊 attachments-report.csv</div></div><div class="report"><h3>Attachment report</h3><div class="row"><span class="okdot">✓</span><span>Project brief.pdf<br><small>2.4 MB</small></span><span class="badge">DOWNLOADED</span></div><div class="row"><span class="okdot">✓</span><span>Roadmap.docx<br><small>486 KB</small></span><span class="badge">DOWNLOADED</span></div><div class="row"><span class="okdot">✓</span><span>dashboard.png<br><small>1.1 MB</small></span><span class="badge">DOWNLOADED</span></div><div class="row"><span class="okdot faildot">!</span><span>Old recording.mp4<br><small>Permission expired · original link kept</small></span><span class="badge" style="background:#fee2e2;color:#b42318">FAILED</span></div></div></div></div>`);
}
function screenshot4() {
  return baseCanvas('Readable now. Structured for later.', 'Open a searchable transcript today — or use JSON and CSV with scripts, spreadsheets and AI tools later.', `<div class="formatgrid" style="position:absolute;left:64px;right:64px;top:245px;bottom:50px"><div class="format"><div class="formathead"><span class="fmticon" style="background:#dbeafe;color:#1d4ed8">HTML</span><div><h3>chat.html</h3><small>Readable offline transcript</small></div></div><div class="htmlpreview"><div class="htmlmsg"><b>Alex · 10:42</b><br>Here is the signed brief and final dashboard.</div><div class="htmlmsg"><b>You · 10:45</b><br>Perfect — I’ll archive everything.</div><div class="htmlmsg"><b>Casey · 10:50</b><br>Older messages loaded successfully.</div></div></div><div class="format"><div class="formathead"><span class="fmticon" style="background:#ede9fe;color:#7c3aed">JSON</span><div><h3>chat.json</h3><small>Structured and machine-readable</small></div></div><pre class="code">{
  "format": "chat-exporter-for-teams/v1",
  "messageCount": 1842,
  "messages": [{
    "author": "Alex",
    "timestamp": "2026-08-02T10:42:00Z",
    "attachments": [ ... ]
  }]
}</pre></div><div class="format"><div class="formathead"><span class="fmticon" style="background:#dcfce7;color:#15803d">CSV</span><div><h3>chat.csv</h3><small>Excel and spreadsheet friendly</small></div></div><pre class="code" style="background:#f8fafc;color:#334155">Index, Date/time, Author, Text
1, 2026-08-02 10:42, Alex,
"Here is the signed brief"
2, 2026-08-02 10:45, You,
"Perfect — archive everything"
3, 2026-08-02 10:50, Casey,
"Older messages loaded"</pre></div></div>`);
}
function screenshot5() {
  return baseCanvas('Processed locally. Nothing sent to us.', 'Your signed-in browser reads the open conversation, builds the archive on this device and saves it directly.', `<div class="flow" style="position:absolute;left:64px;right:64px;top:255px"><div class="flowcard"><div style="font-size:54px;margin-bottom:10px">💬</div><h3>Open Teams chat</h3><p>Content already visible to your signed-in account</p></div><div class="arrow">→</div><div class="flowcard"><img src="${iconData}"><h3>Local browser processing</h3><p>No account, analytics, telemetry or developer server</p></div><div class="arrow">→</div><div class="flowcard"><div style="font-size:54px;margin-bottom:10px">📦</div><h3>Private ZIP</h3><p>Saved directly to your computer</p></div><div class="cloud"><div class="cloudshape"></div><div class="slash"></div></div></div><div class="privacyline">✓ Local-first · Open source · No admin access</div>`);
}
function promoSmall() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="promo"><img src="${iconData}"><div><h1>Chat Exporter</h1><p>Chat + files → one ZIP</p><span class="pill">LOCAL-FIRST · OPEN SOURCE</span></div></div></body></html>`;
}
function promoMarquee() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="marquee"><div><img src="${iconData}" style="width:82px;height:82px;border-radius:23px;box-shadow:0 20px 45px rgba(0,0,0,.28);margin-bottom:25px"><h1>Keep the conversation.<br>Keep the files.</h1><p>Export Microsoft Teams chat history, accessible attachments and useful structured formats in one private ZIP.</p></div><div class="pack"><div class="packcard c1">HTML<span>Readable</span></div><div class="packcard c2">JSON / CSV<span>Structured</span></div><div class="packcard c3">FILES<span>Accessible</span></div><div class="packlid"></div><div class="packbox"></div></div></div></body></html>`;
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error(`Could not connect to ${webSocketUrl}`)), { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(`${message.error.code}: ${message.error.message}`)); else resolve(message.result || {});
  });
  return { async send(method, params = {}) { await opened; const id = nextId++; const promise = new Promise((resolve, reject) => pending.set(id, { resolve, reject })); socket.send(JSON.stringify({ id, method, params })); return promise; }, close() { socket.close(); } };
}

const profile = await mkdtemp(path.join(os.tmpdir(), 'chat-exporter-assets-'));
const child = spawn('xvfb-run', ['-a', '-s', '-screen 0 1600x1000x24', '/usr/lib/chromium/chromium', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-sync', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
let log = '';
child.stderr.setEncoding('utf8'); child.stderr.on('data', (chunk) => { log += chunk; });
let pageClient; let browserClient;
try {
  let port; let browserPath;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { [port, browserPath] = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); if (port && browserPath) break; } catch {}
    await delay(100);
  }
  if (!port) throw new Error(`Chromium did not start. ${log.slice(-3000)}`);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((item) => item.type === 'page');
  pageClient = createCdpClient(page.webSocketDebuggerUrl);
  browserClient = createCdpClient(`ws://127.0.0.1:${port}${browserPath}`);
  await pageClient.send('Page.enable');
  await pageClient.send('Runtime.enable');
  const frameTree = await pageClient.send('Page.getFrameTree');
  const frameId = frameTree.frameTree.frame.id;
  async function capture(html, width, height, output) {
    await pageClient.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false, screenWidth: width, screenHeight: height });
    await pageClient.send('Page.setDocumentContent', { frameId, html });
    await pageClient.send('Runtime.evaluate', { expression: 'document.fonts ? document.fonts.ready : Promise.resolve()', awaitPromise: true });
    await delay(120);
    const result = await pageClient.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await writeFile(output, Buffer.from(result.data, 'base64'));
  }
  const jobs = [
    [screenshot1('en'), 1280, 800, 'store-assets/screenshots/en/01-export-one-zip.png'],
    [screenshot2('en'), 1280, 800, 'store-assets/screenshots/en/02-long-chat-progress.png'],
    [screenshot3(), 1280, 800, 'store-assets/screenshots/en/03-messages-and-files.png'],
    [screenshot4(), 1280, 800, 'store-assets/screenshots/en/04-html-json-csv.png'],
    [screenshot5(), 1280, 800, 'store-assets/screenshots/en/05-local-processing.png'],
    [screenshot1('ru'), 1280, 800, 'store-assets/screenshots/ru/01-export-one-zip.png'],
    [screenshot2('ru'), 1280, 800, 'store-assets/screenshots/ru/02-long-chat-progress.png'],
    [promoSmall(), 440, 280, 'store-assets/small-promo-440x280.png'],
    [promoMarquee(), 1400, 560, 'store-assets/marquee-1400x560.png'],
  ];
  for (const [html, width, height, relative] of jobs) await capture(html, width, height, path.join(root, relative));
  await browserClient.send('Browser.close');
  console.log(`Generated ${4 + jobs.length} icon and store assets.`);
} finally {
  try { pageClient?.close(); } catch {}
  try { browserClient?.close(); } catch {}
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  await delay(150);
  await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
}
