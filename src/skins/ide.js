const CT_SKIN_IDE = {
  id: 'ide',
  name: 'Code editor',
  title: 'auth.service.ts — api — Visual Studio Code',
  favicon: ctIdeIcon(false),
  faviconAlert: ctIdeIcon(true),
  titleAlertPrefix: '● ',
  css: `
/* Inheritable properties cross the shadow boundary, and a page rule on the host element
   beats :host, so anything inheritable is set on .ct-root inside the tree. :host carries
   only the backdrop, which nothing inherits. */
:host { background: #1e1e1e; }
* { box-sizing: border-box; margin: 0; padding: 0; }
.ct-root {
  display: flex; flex-direction: column; height: 100%;
  background: #1e1e1e; color: #cccccc;
  font-family: -apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  font-size: 13px; line-height: normal; letter-spacing: normal; text-align: left;
  cursor: default; user-select: none; -webkit-font-smoothing: antialiased;
}

.ct-titlebar { height: 30px; background: #323233; display: flex; align-items: center; padding: 0 10px; gap: 8px; flex: 0 0 auto; }
.ct-tb-dot { width: 12px; height: 12px; border-radius: 50%; }
.ct-red { background: #ff5f57; } .ct-yellow { background: #febc2e; } .ct-green { background: #28c840; }
.ct-tb-title { flex: 1; text-align: center; color: #9d9d9d; font-size: 12px; }

.ct-body { flex: 1; display: flex; min-height: 0; }

.ct-activitybar { width: 48px; background: #333333; display: flex; flex-direction: column; align-items: center; padding-top: 8px; gap: 16px; flex: 0 0 auto; color: #858585; font-size: 22px; }
.ct-ab-icon.ct-active { color: #fff; box-shadow: inset 2px 0 0 #fff; width: 48px; text-align: center; }
.ct-ab-icon.ct-bottom { margin-top: auto; margin-bottom: 12px; }

.ct-sidebar { width: 240px; background: #252526; flex: 0 0 auto; overflow: hidden; }
.ct-side-head { padding: 8px 16px; font-size: 11px; letter-spacing: .08em; color: #bbbbbb; }
.ct-tree { font-size: 13px; }
.ct-node { padding: 2px 8px 2px 16px; white-space: nowrap; color: #cccccc; line-height: 1.7; }
.ct-indent { padding-left: 28px; } .ct-indent2 { padding-left: 44px; }
.ct-node.ct-sel { background: #094771; }

.ct-editor { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #1e1e1e; }
.ct-tabs { height: 35px; background: #2d2d2d; display: flex; flex: 0 0 auto; }
.ct-tab { padding: 0 14px; display: flex; align-items: center; gap: 8px; color: #969696; background: #2d2d2d; font-size: 13px; border-right: 1px solid #1e1e1e; }
.ct-tab.ct-tab-active { background: #1e1e1e; color: #fff; }
.ct-tab .ct-dot { color: #cccccc; font-size: 10px; }

.ct-code { flex: 1; display: flex; overflow: hidden; font-family: "SF Mono", "Cascadia Code", Menlo, Consolas, monospace; font-size: 13px; line-height: 19px; }
.ct-gutter { color: #6e7681; text-align: right; padding: 8px 12px 8px 16px; user-select: none; white-space: pre; }
.ct-source { padding: 8px 0; color: #d4d4d4; white-space: pre; overflow: hidden; }

.ct-kw { color: #569cd6; } .ct-str { color: #ce9178; } .ct-cmt { color: #6a9955; }
.ct-cls { color: #4ec9b0; } .ct-fn { color: #dcdcaa; } .ct-typ { color: #4ec9b0; } .ct-dec { color: #dcdcaa; }
.ct-cursor { display: inline-block; width: 2px; background: #aeafad; animation: ct-blink 1s steps(1) infinite; }
@keyframes ct-blink { 50% { opacity: 0; } }

.ct-terminal { height: 150px; background: #1e1e1e; border-top: 1px solid #2d2d2d; flex: 0 0 auto; display: flex; flex-direction: column; }
.ct-term-tabs { display: flex; gap: 18px; padding: 6px 16px; font-size: 11px; letter-spacing: .06em; color: #969696; }
.ct-term-active { color: #fff; box-shadow: inset 0 -1px 0 #e7e7e7; padding-bottom: 4px; }
.ct-term-body { padding: 6px 16px; font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 12px; line-height: 1.6; color: #cccccc; }
.ct-prompt { color: #569cd6; } .ct-ok { color: #4ec9b0; }

.ct-statusbar { height: 22px; background: #007acc; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-size: 12px; flex: 0 0 auto; }
.ct-sb-left, .ct-sb-right { display: flex; gap: 16px; align-items: center; }
.ct-sb-prob { opacity: .95; }
.ct-sb-ok, .ct-sb-alert { font-variant-numeric: tabular-nums; }

/* Dim by default: the indicator animates only on confirmed recent activity, so a static
   icon honestly means "no recent signal" rather than decoration that always moves. */
.ct-sb-run { display: inline-flex; align-items: center; gap: 5px; opacity: .4; }
.ct-sb-run.ct-on { opacity: 1; }
.ct-sb-run.ct-on .ct-spinner { animation: ct-rot 1.1s linear infinite; display: inline-block; }
@keyframes ct-rot { to { transform: rotate(360deg); } }

/* Exactly one status span shows per level. Only alert hides the liveness indicator, since
   a warning does not mean dead. */
.ct-root[data-ct-level="ok"] .ct-sb-alert { display: none; }
.ct-root[data-ct-level="warn"] .ct-sb-ok { display: none; }
.ct-root[data-ct-level="alert"] .ct-sb-ok { display: none; }
.ct-root[data-ct-level="alert"] .ct-sb-run { display: none; }
.ct-root[data-ct-level="warn"] .ct-statusbar { background: #9a6700; }
.ct-root[data-ct-level="alert"] .ct-statusbar { background: #a1260d; }
.ct-root[data-ct-level="alert"] .ct-sb-alert { font-weight: 700; }
.ct-root[data-ct-level="warn"] .ct-sb-alert::before { content: "⚠ "; }
.ct-root[data-ct-level="alert"] .ct-sb-alert::before { content: "✗ "; }
`,
  html: `
<div class="ct-root" data-ct-level="ok">
  <div class="ct-titlebar">
    <span class="ct-tb-dot ct-red"></span><span class="ct-tb-dot ct-yellow"></span><span class="ct-tb-dot ct-green"></span>
    <span class="ct-tb-title">auth.service.ts — api</span>
  </div>
  <div class="ct-body">
    <div class="ct-activitybar">
      <div class="ct-ab-icon ct-active">⧉</div><div class="ct-ab-icon">⌕</div>
      <div class="ct-ab-icon">⎇</div><div class="ct-ab-icon">⊞</div><div class="ct-ab-icon ct-bottom">⚙</div>
    </div>
    <div class="ct-sidebar">
      <div class="ct-side-head">EXPLORER</div>
      <div class="ct-tree">
        <div class="ct-node ct-open">▾ api</div>
        <div class="ct-node ct-indent">▾ src</div>
        <div class="ct-node ct-indent2">▸ controllers</div>
        <div class="ct-node ct-indent2 ct-sel">auth.service.ts</div>
        <div class="ct-node ct-indent2">user.service.ts</div>
        <div class="ct-node ct-indent2">token.repository.ts</div>
        <div class="ct-node ct-indent">▸ test</div>
        <div class="ct-node ct-indent">package.json</div>
        <div class="ct-node ct-indent">tsconfig.json</div>
      </div>
    </div>
    <div class="ct-editor">
      <div class="ct-tabs"><div class="ct-tab ct-tab-active">auth.service.ts <span class="ct-dot">●</span></div><div class="ct-tab">user.service.ts</div></div>
      <div class="ct-code">
        <pre class="ct-gutter">1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18</pre>
        <pre class="ct-source"><span class="ct-kw">import</span> { Injectable } <span class="ct-kw">from</span> <span class="ct-str">'@nestjs/common'</span>;
<span class="ct-kw">import</span> { JwtService } <span class="ct-kw">from</span> <span class="ct-str">'@nestjs/jwt'</span>;
<span class="ct-kw">import</span> { compare } <span class="ct-kw">from</span> <span class="ct-str">'bcrypt'</span>;

<span class="ct-dec">@Injectable</span>()
<span class="ct-kw">export class</span> <span class="ct-cls">AuthService</span> {
  <span class="ct-kw">constructor</span>(<span class="ct-kw">private readonly</span> jwt: JwtService) {}

  <span class="ct-cmt">// validate credentials and issue a signed session token</span>
  <span class="ct-kw">async</span> <span class="ct-fn">validateUser</span>(email: <span class="ct-typ">string</span>, password: <span class="ct-typ">string</span>) {
    <span class="ct-kw">const</span> user = <span class="ct-kw">await</span> <span class="ct-kw">this</span>.users.findByEmail(email);
    <span class="ct-kw">if</span> (!user || !(<span class="ct-kw">await</span> <span class="ct-fn">compare</span>(password, user.hash))) {
      <span class="ct-kw">throw new</span> <span class="ct-cls">UnauthorizedException</span>(<span class="ct-str">'Invalid credentials'</span>);
    }
    <span class="ct-kw">return</span> <span class="ct-kw">this</span>.jwt.<span class="ct-fn">signAsync</span>({ sub: user.id, email });
  }
}</pre>
      </div>
      <div class="ct-terminal">
        <div class="ct-term-tabs"><span class="ct-term-active">PROBLEMS</span><span>OUTPUT</span><span>TERMINAL</span></div>
        <div class="ct-term-body"><span class="ct-prompt">$</span> npm run build<br/>&gt; api@1.0.0 build<br/>&gt; tsc -p tsconfig.json<br/><span class="ct-ok">✓ compiled successfully in 2.41s</span><br/><span class="ct-prompt">$</span> <span class="ct-cursor">&nbsp;</span></div>
      </div>
    </div>
  </div>
  <div class="ct-statusbar">
    <span class="ct-sb-left"><span class="ct-sb-branch">⎇ main*</span><span>↻ 0↓ 1↑</span><span class="ct-sb-prob">⊗ 0  ⚠ 2</span>
      <span class="ct-sb-ok">✓ <span data-ct-slot="count">0</span> passing</span>
      <span class="ct-sb-alert"><span data-ct-slot="label">Needs attention</span></span>
      <span class="ct-sb-run" data-ct-live><span class="ct-spinner">↻</span> watching</span>
    </span>
    <span class="ct-sb-right"><span>Ln 18, Col 2</span><span>Spaces: 2</span><span>UTF-8</span><span>TypeScript</span></span>
  </div>
</div>`,
};

function ctIdeIcon(badge) {
  return 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
    '<rect width="16" height="16" rx="3" fill="#0065a9"/>' +
    '<text x="8" y="11.5" font-family="monospace" font-size="9" font-weight="700" ' +
    'text-anchor="middle" fill="#fff">&lt;/&gt;</text>' +
    (badge ? '<circle cx="12.5" cy="3.5" r="3" fill="#e51400" stroke="#fff" stroke-width="0.8"/>' : '') +
    '</svg>');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CT_SKIN_IDE };
}
