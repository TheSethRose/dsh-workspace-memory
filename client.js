window.__ModuleLoader__.load({id:'dsh-workspace-memory',factory:(require)=>{
 const React=require('react');const h=React.createElement;
 const kinds=['instruction','fact','decision','working-state'];
 const labels={instruction:'Preference',fact:'Fact',decision:'Decision','working-state':'Working context',proposed:'Needs approval',confirmed:'Approved',superseded:'Replaced',rejected:'Rejected'};
  // Global memory applies to every project, so it only accepts cross-project kinds.
  const globalKinds=['instruction','fact'],GLOBAL_ID='global';
 const css=`.wm{height:100%;overflow:auto;container-type:inline-size;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:14px;line-height:22px}
.wm *,.wm-mini *{box-sizing:border-box}
.wm .shell{width:100%;max-width:none;margin:0;padding:16px 24px 32px;display:grid;gap:16px}
.wm h1{font-size:20px;font-weight:500;line-height:28px;margin:0}
.wm h2{font-size:16px;font-weight:500;line-height:28px;margin:0}
.wm h3{font-size:14px;font-weight:500;line-height:24px;margin:0}
.wm p{margin:0}
.wm .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wm .between{justify-content:space-between}
.wm .muted{color:var(--dsw-alias-label-secondary)}
.wm .small{font-size:12px;line-height:20px}
.wm .path{overflow-wrap:anywhere}
.wm .heading{align-items:flex-start;gap:12px}
.wm .heading .muted{font-size:12px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
.wm .heading-actions{gap:8px}
.wm .card{--dsw-elevation-stroke-color:var(--dsw-alias-border-l2);border:0;border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-stroke),0 3px 8px #00000008,0 0 16px #00000005;padding:16px}
.wm button,.wm-mini button{font-family:inherit;font-size:14px;line-height:22px;height:36px;padding:0 14px;border:0;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;transition:background-color 100ms var(--ds-ease-in-out)}
.wm button:hover:not(:disabled),.wm-mini button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.wm button:active:not(:disabled),.wm-mini button:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}
.wm button:disabled,.wm-mini button:disabled{opacity:.4;cursor:not-allowed}
.wm .outline{box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l3)}
.wm .sm{height:28px;padding:0 10px;border-radius:var(--dsw-radius-sm);font-size:12px;line-height:18px}
.wm .primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.wm .primary:hover:not(:disabled),.wm .primary:active:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.wm .danger{color:var(--dsw-alias-state-error-primary)}
.wm .danger:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}
.wm :focus-visible,.wm-mini :focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.wm input:not([type=checkbox]),.wm select,.wm textarea{font-family:inherit;font-size:14px;line-height:22px;min-height:32px;height:32px;padding:0 8px;border:0;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l4);min-width:0;max-width:100%}
.wm textarea{height:auto;min-height:150px;padding:8px 12px;resize:vertical}
.wm input[type=checkbox]{width:16px;height:16px;flex:none;margin:0;accent-color:var(--dsw-alias-brand-primary)}
.wm input[type=checkbox]:focus-visible{outline-offset:2px}
.wm input::placeholder,.wm textarea::placeholder{color:var(--dsw-alias-label-dimmed)}
.wm label{display:flex;align-items:center;gap:6px}
.wm .field{display:grid;gap:6px;font-size:13px;font-weight:500;line-height:20px}
.wm .scope{gap:8px}
.wm .scope label{display:grid;gap:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.wm .scope-state{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.wm .toolbar{gap:8px}
.wm .toolbar .search{flex:1 1 200px}
.wm .settings{padding:0 16px}
.wm .settings>summary{min-height:36px;margin-left:-6px;border-radius:var(--dsw-radius-sm);padding:0 6px}
.wm .settings-body{padding-bottom:16px}
.wm .setting{display:grid;grid-template-columns:16px minmax(0,1fr);align-items:start;gap:6px 8px;padding:12px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);cursor:pointer}
.wm .setting:last-child{border-bottom:0}
.wm .setting>input{margin-top:3px}
.wm .setting strong{display:block;font-size:13px;font-weight:500;line-height:20px}
.wm .setting span span{display:block;font-size:12px;font-weight:400;line-height:20px;color:var(--dsw-alias-label-secondary)}
.wm .setting-control{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:12px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.wm .setting-control:last-child{border-bottom:0}
.wm .setting-control>label{display:grid;gap:4px;font-size:13px;font-weight:500;line-height:20px}
.wm .setting-control .small{font-weight:400;color:var(--dsw-alias-label-secondary)}
.wm .settings input[type=number]{height:34px;padding:0 12px;font-size:13px}
.wm .settings-foot{display:flex;gap:8px;flex-wrap:wrap;padding:12px 0 0;border-top:.5px solid var(--dsw-alias-border-l2)}
.wm .status-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 0;border-top:.5px solid var(--dsw-alias-border-l2)}
.wm details>summary{cursor:pointer;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);width:fit-content;min-height:28px;display:flex;align-items:center;gap:6px;list-style:none;border-radius:var(--dsw-radius-sm);padding:0 6px;margin-left:-6px;transition:background-color 100ms var(--ds-ease-in-out)}
.wm details>summary:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wm details>summary::-webkit-details-marker{display:none}
.wm details>summary::before{content:'▸';font-size:12px;color:var(--dsw-alias-label-caption);transition:transform 120ms var(--ds-ease-in-out)}
.wm details[open]>summary::before{transform:rotate(90deg)}
.wm .section{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:12px;margin-top:0;display:grid;gap:8px;justify-items:start}
.wm .section-body{display:grid;gap:8px;width:100%;padding-top:8px}
.wm .detail{display:grid;gap:12px;align-content:start;justify-items:start}
.wm .detail>*{width:100%}
.wm .actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:auto}
.wm .actions button{width:auto}
.wm .grid{display:grid;grid-template-columns:minmax(300px,420px) minmax(0,1fr);gap:16px;align-items:start}
.wm .grid.editor-only{grid-template-columns:minmax(0,1fr);max-width:none;margin:0;width:100%}
.wm .list-card{padding:4px}
.wm .list-heading{font-size:12px;line-height:20px;padding:8px 12px 4px;color:var(--dsw-alias-label-tertiary)}
.wm .list{display:grid;gap:2px;max-height:min(56vh,560px);overflow:auto;scrollbar-gutter:stable;padding-right:2px}
.wm .record{display:grid;gap:3px;justify-items:start;text-align:left;height:auto;min-height:36px;padding:8px 10px;width:100%;border-radius:var(--dsw-radius-md);color:var(--dsw-alias-label-secondary)}
.wm .record strong{font-size:14px;font-weight:500;line-height:22px;color:var(--dsw-alias-label-primary);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wm .record-preview{font-size:12px;line-height:20px;color:var(--dsw-alias-label-tertiary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.wm .record[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary)}
.wm .record[aria-pressed=true]:hover{background:var(--dsw-alias-interactive-bg-active)}
.wm .record-row{display:flex;align-items:stretch;gap:2px;border-radius:var(--dsw-radius-md)}
.wm .record-open{flex:1 1 auto;min-width:0;width:auto}
.wm .record-delete{flex:0 0 auto;width:34px;min-height:36px;padding:0;font-size:13px;color:var(--dsw-alias-label-tertiary);opacity:.65}
.wm .record-row:hover .record-delete,.wm .record-delete:focus-visible{opacity:1}
.wm .record-delete:hover:not(:disabled){color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}
.wm .pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border-radius:999px;corner-shape:round;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.wm .pill::before{content:'';width:6px;height:6px;flex:none;border-radius:50%;corner-shape:round;background:var(--dsw-alias-state-idle-primary)}
.wm .pill[data-tone=proposed]::before{background:var(--dsw-alias-state-warn-primary)}
.wm .pill[data-tone=confirmed]::before{background:var(--dsw-alias-state-success-primary)}
.wm .pill[data-tone=rejected]::before{background:var(--dsw-alias-state-error-primary)}
.wm .tag{font-size:11px;line-height:17px;padding:1px 8px;border-radius:999px;corner-shape:round;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-module-platform)}
.wm .content{font-size:14px;line-height:24px;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
.wm .meta{font-size:12px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
.wm .wrap{overflow-wrap:anywhere}
.wm pre{font-family:var(--ds-font-family-code);font-size:11px;line-height:19px;background:var(--dsw-alias-markdown-code-block);border-radius:var(--dsw-radius-md);padding:8px 10px;margin:6px 0 0;overflow:auto;max-height:240px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}
.wm code{font-family:var(--ds-font-family-code);font-size:12px;line-height:19px;background:var(--dsw-alias-markdown-inline-code);border-radius:var(--dsw-radius-sm);padding:0 5px}
.wm .history-entry{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:8px;margin-top:8px;display:grid;gap:4px}
.wm .history-entry strong{font-size:13px;font-weight:500;line-height:20px}
.wm .advanced>summary{margin-left:-6px}
.wm .advanced-body{display:grid;gap:12px;padding:12px 0 4px}
.wm .delete-confirm{--dsw-elevation-stroke-color:var(--dsw-alias-state-error-primary);display:grid;gap:8px;margin-top:12px}
.wm .empty{display:grid;justify-items:center;gap:8px;text-align:center;margin-top:80px;padding:0 16px}
.wm .detail .empty{margin-top:32px}
.wm .empty-icon{font-size:24px;line-height:28px;color:var(--dsw-alias-label-caption)}
.wm .empty p{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);max-width:52ch}
.wm .error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary);border-radius:var(--dsw-radius-md);padding:8px 12px;font-size:13px;line-height:20px;display:grid;gap:2px}
.wm .busy{font-size:12px;line-height:20px;min-height:20px;color:var(--dsw-alias-label-tertiary)}
.wm .usage-list{display:grid;gap:2px}
.wm .usage-list>details{border-bottom:.5px solid var(--dsw-alias-border-l2);padding-bottom:4px}
.wm .footer{font-size:12px;line-height:20px;color:var(--dsw-alias-label-tertiary);max-width:78ch}
.wm .onboarding-hint{margin-top:12px}
.wm-mini{font-family:var(--dsw-font-family);font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;gap:8px}
.wm-mini button{height:28px;padding:0 10px;border-radius:var(--dsw-radius-sm);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.wm-mini button:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.wm-mini .wm-disclosure{display:inline-block}
.wm-mini .wm-disclosure>summary{display:flex;align-items:center;gap:6px;height:28px;padding:0 8px;margin-left:-8px;border-radius:var(--dsw-radius-sm);font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);cursor:pointer;list-style:none;transition:background-color 100ms var(--ds-ease-in-out),color 100ms var(--ds-ease-in-out)}
.wm-mini .wm-disclosure>summary:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wm-mini .wm-disclosure>summary strong{font-weight:500}
.wm-mini .wm-disclosure>summary::-webkit-details-marker{display:none}
.wm-mini .wm-disclosure>summary::before{content:'▸';font-size:12px;color:var(--dsw-alias-label-caption);transition:transform 120ms var(--ds-ease-in-out)}
.wm-mini .wm-disclosure[open]>summary::before{transform:rotate(90deg)}
.wm-mini .disclosure-body{display:grid;gap:8px;padding:8px 0 4px 12px;border-left:.5px solid var(--dsw-alias-border-l2);margin:2px 0 0 4px}
.wm-mini .disclosure-body p{font-size:12px;line-height:20px;margin:0;color:var(--dsw-alias-label-secondary)}
.wm-mini .disclosure-body>details>summary{font-size:12px;line-height:20px;min-height:24px}
.wm-mini .step-log{display:grid;gap:6px;max-height:240px;overflow:auto;scrollbar-gutter:stable}
.wm-mini .step-row{display:grid;gap:2px;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.wm-mini .step-meta,.wm-mini .step-record{font-family:var(--ds-font-family-code);font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.wm-mini .disclosure-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wm-mini .disclosure-note{font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
@container (max-width:860px){.wm .grid{grid-template-columns:minmax(0,1fr)}.wm .list{max-height:320px}.wm .detail-empty{display:none}}
@container (max-width:560px){.wm .shell{padding:16px 20px 32px}.wm .scope{display:grid;gap:12px}.wm .heading{display:grid}.wm .heading-actions{width:100%}.wm .heading-actions .primary{flex:1}.wm .toolbar .search{flex:1 1 100%}.wm .toolbar select{flex:1 1 40%}}
@media (prefers-reduced-motion:reduce){.wm *,.wm-mini *{transition:none!important;animation:none!important}}`;
 function apply(ctx){
  const style=document.createElement('style');style.textContent=css;ctx.effect(()=>{document.head.appendChild(style);return()=>style.remove();});
  const slots=ctx.get('slots'),layout=ctx.get('layout');if(!slots||!layout)throw Error('Memory needs slots and layout');
  let focus={workspaceId:'',sessionId:'',draft:null};
  const changed=()=>window.dispatchEvent(new Event('workspace-memory-changed'));
  async function api(operation,args={}){const response=await fetch('/workspace-memory/api',{method:'POST',headers:{'Content-Type':'application/json','X-Workspace-Memory':'1'},body:JSON.stringify({operation,args})});const body=await response.json();if(!response.ok)throw Error(body.error??'Memory request failed');return body.result;}
  const freshDraft=(source={origin:'manual'})=>({title:'',content:'',kind:'fact',pinned:false,enabled:true,expiresAt:null,supersedes:null,source});
  async function open(sessionId,draft=null){const ws=await api('workspaces');const w=ws.find(w=>w.sessionIds.includes(sessionId));focus={workspaceId:w?.id??'',sessionId:sessionId??'',draft};layout.selectPanel('workspace-memory');window.dispatchEvent(new CustomEvent('workspace-memory-focus',{detail:focus}));changed();}
  function Button({children,onClick,disabled,className,title}){return h('button',{type:'button',onClick,disabled,className,title},children);}
  function StepLog({rows}){return h('div',{className:'step-log'},...rows.map(u=>h('div',{key:u.sessionId+':'+u.turn+':'+u.step,className:'step-row'},h('strong',null,'Step '+u.step+' · '+(u.enabled?u.selected.length+' included':'memory off')),h('div',{className:'step-meta'},(u.state==='started'?'Invocation started':'Context prepared')+(u.retrieval?', '+u.retrieval:'')+' · '+u.usedChars.toLocaleString()+' characters'),...u.selected.map(r=>h('div',{key:r.id,className:'step-record'},r.id+' · revision '+r.revision+' · '+r.reason)),u.overflow.length>0&&h('div',null,u.overflow.length+' omitted by budget or limit'))));}
  function Panel(){
   const [workspaces,setWorkspaces]=React.useState([]),[workspaceId,setWorkspaceId]=React.useState(focus.workspaceId),[sessionId,setSessionId]=React.useState(focus.sessionId),[records,setRecords]=React.useState([]),[query,setQuery]=React.useState(''),[status,setStatus]=React.useState(''),[kind,setKind]=React.useState(''),[selected,setSelected]=React.useState(null),[draft,setDraft]=React.useState(focus.draft),[config,setConfig]=React.useState(null),[uses,setUses]=React.useState([]),[preview,setPreview]=React.useState(null),[error,setError]=React.useState(''),[notice,setNotice]=React.useState(''),[busy,setBusy]=React.useState(false),[loading,setLoading]=React.useState(true),[tick,setTick]=React.useState(0),[deleting,setDeleting]=React.useState(false),[embedding,setEmbedding]=React.useState(null);
   const current=records.find(r=>r.id===selected),workspace=workspaces.find(w=>w.id===workspaceId),globalScope=workspaceId===GLOBAL_ID;
   const filtered=records.filter(r=>(!query||[r.title,r.content].some(t=>t.toLocaleLowerCase().includes(query.toLocaleLowerCase())))&&(!status||r.status===status)&&(!kind||r.kind===kind));
   React.useEffect(()=>{let alive=true;api('workspaces').then(ws=>{if(!alive)return;setWorkspaces(ws);if(!focus.workspaceId)setWorkspaceId(ws[0]?.id??'');if(!ws.length)setLoading(false);}).catch(e=>{if(alive){setError(e.message);setLoading(false);}});return()=>{alive=false;};},[]);
   React.useEffect(()=>{const onChange=()=>setTick(n=>n+1);const onFocus=e=>changeScope(e.detail.workspaceId,e.detail.sessionId,e.detail.draft);window.addEventListener('workspace-memory-changed',onChange);window.addEventListener('workspace-memory-focus',onFocus);return()=>{window.removeEventListener('workspace-memory-changed',onChange);window.removeEventListener('workspace-memory-focus',onFocus);};},[]);
   React.useEffect(()=>{if(!workspaceId)return;let alive=true;setLoading(true);const global=workspaceId===GLOBAL_ID;Promise.all([api('list',global?{scope:GLOBAL_ID}:{workspaceId}),global?Promise.resolve(null):api('settings',{workspaceId,...sessionId?{sessionId}:{}}),global?Promise.resolve([]):api('usage',{workspaceId,...sessionId?{sessionId}:{}}),api('embeddingStatus')]).then(([r,c,u,e])=>{if(!alive)return;setRecords(r);setConfig(c);setUses(u);setEmbedding(e);setLoading(false);}).catch(e=>{if(alive){setError(e.message);setLoading(false);}});return()=>{alive=false;};},[workspaceId,sessionId,tick]);
   function changeScope(w,s,nextDraft=null){focus={workspaceId:w,sessionId:s,draft:nextDraft};setWorkspaceId(w);setSessionId(s);setRecords([]);setConfig(null);setUses([]);setSelected(null);setDraft(nextDraft);setPreview(null);setDeleting(false);setError('');setNotice('');setQuery('');setStatus('');setKind('');}
   async function run(fn,message='Changes saved.'){setBusy(true);setError('');setNotice('');try{await fn();setTick(n=>n+1);changed();if(message)setNotice(message);}catch(e){setError(e.message);}finally{setBusy(false);}}
   const mutate=(op,args={})=>api(op,{...(workspaceId===GLOBAL_ID?{scope:GLOBAL_ID}:{workspaceId}),...args});
   const btn=(label,fn,className,message)=>h(Button,{disabled:busy,onClick:()=>run(fn,message),className},label);
   function newDraft(){setSelected(null);setDeleting(false);setNotice('');setDraft(globalScope?{...freshDraft(),kind:'instruction',pinned:true}:freshDraft());}
   const field=(key,value)=>setDraft(d=>({...d,[key]:value}));
   async function save(confirm){const input={};for(const key of ['title','content','kind','pinned','enabled','expiresAt','supersedes'])input[key]=draft[key];input.source={...draft.source,...sessionId?{session:sessionId}:{}};let r=selected?await mutate('update',{id:selected,expectedRevision:draft.revision,changes:input}):await mutate('create',{input});setSelected(r.id);setDraft({...r});if(confirm&&r.status==='proposed')r=await mutate('approve',{id:r.id,expectedRevision:r.revision});setSelected(r.id);setDraft(null);focus.draft=null;}
   const editor=()=>h('form',{onSubmit:e=>{e.preventDefault();run(()=>save(true),'Memory saved and approved.');}},
    h('h2',null,selected?'Edit memory':'Create a memory'),
    draft.source?.origin==='message-action'&&h('p',{className:'muted small'},'Linked to the assistant reply. Add the information you want to keep.'),
    h('label',{className:'field'},'Title',h('input',{'aria-label':'Memory title',autoFocus:true,required:true,maxLength:240,placeholder:'A short, recognizable name',value:draft.title,disabled:busy,onChange:e=>field('title',e.target.value)})),
    h('label',{className:'field'},'What should be remembered?',h('textarea',{'aria-label':'Memory content',placeholder:'For example: Use pnpm for this project.',required:true,maxLength:32000,value:draft.content,disabled:busy,onChange:e=>field('content',e.target.value)})),
    h('label',{className:'field'},'Type',h('select',{'aria-label':'Memory entry kind',value:draft.kind,disabled:busy,onChange:e=>field('kind',e.target.value)},...(globalScope?globalKinds:kinds).map(k=>h('option',{key:k,value:k},labels[k])))),
    globalScope&&h('p',{className:'muted small'},'Global memory applies to every project, so it only accepts a preference or a fact. Project decisions and working context stay in their workspace. Pin it to include it in every request, not only matching ones.'),
    h('div',{className:'row'},h('label',null,h('input',{type:'checkbox',checked:draft.pinned,disabled:busy,onChange:e=>field('pinned',e.target.checked)}),'Pin for priority'),h('label',null,h('input',{type:'checkbox',checked:draft.enabled,disabled:busy,onChange:e=>field('enabled',e.target.checked)}),'Enabled')),
    h('details',{className:'advanced'},h('summary',null,'Expiry & replacement'),h('div',{className:'advanced-body'},h('label',{className:'field'},'Expiry (UTC, optional)',h('input',{'aria-label':'Memory expiry',placeholder:'2026-12-31T23:59:59Z',value:draft.expiresAt??'',disabled:busy,onChange:e=>field('expiresAt',e.target.value||null)})),h('label',{className:'field'},'Replaces',h('select',{'aria-label':'Superseded memory',value:draft.supersedes??'',disabled:busy,onChange:e=>field('supersedes',e.target.value||null)},h('option',{value:''},'None'),...records.filter(r=>r.id!==selected).map(r=>h('option',{key:r.id,value:r.id},r.title)))),h('p',{className:'muted small'},'Pinned memories still respect expiry and the context budget. A replacement takes effect only after approval.'))),
    h('p',{className:'muted small'},'Approve to allow reuse in future requests, or save a suggestion for later review.'),h('div',{className:'actions'},h('button',{type:'submit',className:'primary',disabled:busy},busy?'Saving…':'Save & approve'),h(Button,{disabled:busy,onClick:()=>{const f=document.querySelector('.wm form');if(f?.reportValidity())run(()=>save(false),'Suggestion saved. Approval is required before reuse.');}},'Save as suggestion'),h(Button,{disabled:busy,onClick:()=>{setDraft(null);focus.draft=null;}},'Cancel')));
   const detail=()=>h(React.Fragment,null,
    h('div',{className:'row between'},h('h2',{className:'wrap'},current.title),h('span',{className:'pill','data-tone':current.status},labels[current.status])),h('div',{className:'content'},current.content),h('div',{className:'meta'},labels[current.kind]+' · Revision '+current.revision+' · Updated '+new Date(current.updatedAt).toLocaleString()),
    current.status==='proposed'&&h('p',{className:'muted small'},'This suggestion is not used in requests until you approve it.'),
    h('div',{className:'actions'},current.status==='proposed'&&btn('Approve',()=>mutate('approve',{id:current.id,expectedRevision:current.revision}),'primary','Memory approved.'),h(Button,{disabled:busy,onClick:()=>{setDraft({...current});setDeleting(false);}},'Edit'),current.status==='proposed'&&btn('Reject',()=>mutate('reject',{id:current.id,expectedRevision:current.revision}),undefined,'Suggestion rejected.'),h(Button,{disabled:busy,className:'danger',onClick:()=>{setDeleting(true);setNotice('');}},'Delete')),deleting&&h('div',{className:'card delete-confirm',role:'group','aria-label':'Confirm deletion'},h('h3',null,'Delete this memory permanently?'),h('p',{className:'small'},'This deletes the memory and revision history, not source chats or previously sent requests.'),h('div',{className:'actions'},btn('Delete permanently',async()=>{await mutate('remove',{id:current.id,expectedRevision:current.revision});setSelected(null);setDeleting(false);},'danger','Memory deleted.'),h(Button,{onClick:()=>setDeleting(false)},'Keep memory'))),
    h('div',{className:'section'},h('div',{className:'actions'},btn(current.pinned?'Unpin':'Pin',()=>mutate('update',{id:current.id,expectedRevision:current.revision,changes:{pinned:!current.pinned}})),btn(current.enabled?'Disable':'Enable',()=>mutate('update',{id:current.id,expectedRevision:current.revision,changes:{enabled:!current.enabled}})),sessionId&&config&&btn(config.excluded.includes(current.id)?'Include in this session':'Exclude in this session',()=>api('setSettings',{workspaceId,sessionId,value:{...config,excluded:config.excluded.includes(current.id)?config.excluded.filter(id=>id!==current.id):[...config.excluded,current.id]}}))),
    h('details',{className:'section'},h('summary',null,'Source & revision history ('+current.history.length+')'),h('pre',null,JSON.stringify(current.source,null,2)),current.expiresAt&&h('p',{className:'small'},'Expires '+current.expiresAt),current.supersedes&&h('p',{className:'small wrap'},'Replaces '+current.supersedes),...current.history.slice().reverse().map(r=>h('div',{key:r.revision,className:'history-entry'},h('strong',null,'Revision '+r.revision+' · '+labels[r.status]),h('div',{className:'muted small'},new Date(r.updatedAt).toLocaleString()),h('pre',null,r.content),h('details',null,h('summary',null,'Revision metadata'),h('pre',null,JSON.stringify({title:r.title,kind:r.kind,source:r.source,pinned:r.pinned,enabled:r.enabled,expiresAt:r.expiresAt,supersedes:r.supersedes},null,2))),btn('Restore as suggestion',()=>mutate('restore',{id:current.id,targetRevision:r.revision,expectedRevision:current.revision}),undefined,'Revision restored as a suggestion. Review before approval.')))),
    h('details',{className:'section'},h('summary',null,'Replacement'),h('div',{className:'section-body'},h('p',{className:'small muted'},'Mark a memory replaced when it is no longer current. Deletion uses the red Delete action above and removes this memory together with its revision history.'),h('div',{className:'actions'},btn('Mark replaced',()=>mutate('update',{id:current.id,expectedRevision:current.revision,changes:{status:'superseded'}})))))),
   );
   return h('section',{className:'wm','aria-label':'Workspace memory'},h('div',{className:'shell'},
    h('header',{className:'row between heading'},h('div',null,h('h1',null,'Workspace memory'),h('div',{className:'muted'},'Keep useful context. Review what your assistant remembers.')),h('div',{className:'row heading-actions'},btn('Refresh',async()=>setWorkspaces(await api('workspaces')),undefined,'Memory refreshed.'),h(Button,{onClick:newDraft,disabled:busy||!workspaceId,className:'primary'},'Create memory'))),
    h('div',{className:'card scope'},h('div',{className:'row'},h('label',null,'Workspace',h('select',{'aria-label':'Memory workspace',value:workspaceId,disabled:busy,onChange:e=>changeScope(e.target.value,'')},...workspaces.map(w=>h('option',{key:w.id,value:w.id},w.title||w.path)),h('option',{value:GLOBAL_ID},'Global · all workspaces'))),!globalScope&&h('label',null,'Scope',h('select',{'aria-label':'Memory settings scope',value:sessionId,disabled:busy,onChange:e=>changeScope(workspaceId,e.target.value)},h('option',{value:''},'Workspace defaults'),...(workspace?.sessionIds??[]).map(id=>h('option',{key:id,value:id},'Session '+id.slice(0,12))))),globalScope?h('span',{className:'scope-state muted'},'Applies to every project'):config&&h('span',{className:'scope-state muted'},config.enabled?'Memory context on':'Memory context off')),globalScope?h('div',{className:'path muted'},'A writing style, tone, or a stable fact about you. Every project receives it; a project entry overrides it when the two conflict.'):workspace&&h('div',{className:'path muted'},workspace.path)),
    error&&h('div',{className:'error',role:'alert'},error,h('div',{className:'small'},'Your input is preserved. Refresh if another session changed this memory.')),
    h('div',{className:'busy muted',role:'status','aria-live':'polite'},busy?'Saving…':loading?'Loading memory…':notice),
    !workspaceId&&!loading?h('div',{className:'card empty'},h('h2',null,'No workspace yet'),h('p',null,'Register a workspace to keep its memories separate from other projects.')):h(React.Fragment,null,
     config&&h('details',{className:'card settings'},h('summary',null,'Memory settings',h('span',{className:'small'},' · '+(sessionId?'This session':'Workspace defaults'))),h('div',{className:'settings-body'},h('label',{className:'setting'},h('input',{type:'checkbox',checked:config.enabled,disabled:busy,onChange:e=>setConfig({...config,enabled:e.target.checked})}),h('span',null,h('strong',null,'Use memory in requests'),h('span',null,'Turning this off keeps saved memories, but stops automatic context.'))),h('label',{className:'setting'},h('input',{type:'checkbox',checked:config.suggestions,disabled:busy,onChange:e=>setConfig({...config,suggestions:e.target.checked})}),h('span',null,h('strong',null,'Allow assistant suggestions'),h('span',null,'Suggestions always need your approval before reuse.'))),h('label',{className:'setting'},h('input',{type:'checkbox',checked:config.semantic,disabled:busy,onChange:e=>setConfig({...config,semantic:e.target.checked})}),h('span',null,h('strong',null,'Find memories by meaning'),h('span',null,'Uses the local embedding model, then falls back to keyword matching when it is unavailable.'))),h('div',{className:'setting-control'},h('label',null,'Context budget',h('span',{className:'small'},'Characters of memory context allowed per request.')),h('input',{'aria-label':'Memory context budget',type:'number',min:1000,max:64000,step:1000,value:config.budgetChars,disabled:busy,onChange:e=>setConfig({...config,budgetChars:Number(e.target.value)})})),config.semantic&&h('div',{className:'setting-control'},h('label',null,'Relevance threshold',h('span',{className:'small'},'Minimum similarity for a memory found by meaning only.')),h('input',{'aria-label':'Semantic relevance threshold',type:'number',min:0,max:1,step:0.05,value:config.semanticThreshold,disabled:busy,onChange:e=>setConfig({...config,semanticThreshold:Number(e.target.value)})})),h('div',{className:'status-row'},h('div',null,h('div',{className:'small'},config.semantic?(embedding?.available?'Local embedding service responding.':(embedding?.error??'Checking the local service…')):'Local embeddings are not used while meaning search is off.')),h('span',{className:'tag'},embedding?embedding.model:'checking…')),h('p',{className:'small muted'},sessionId?'Applies only to this session. Memories are still shared within this workspace.':'Applies to sessions without a settings override.'),h('div',{className:'settings-foot'},btn('Save settings',()=>{if(!Number.isInteger(config.budgetChars)||config.budgetChars<1000||config.budgetChars>64000)throw Error('Set a context budget between 1,000 and 64,000 characters.');if(!(config.semanticThreshold>=0&&config.semanticThreshold<=1))throw Error('Set a relevance threshold between 0 and 1.');return api('setSettings',{workspaceId,...sessionId?{sessionId}:{},value:config});},'primary','Settings saved.'),sessionId&&btn('Use workspace defaults',()=>api('resetSession',{workspaceId,sessionId}),'outline','Session now uses workspace defaults.')))),
     records.length>0&&h('div',{className:'row toolbar'},h('input',{'aria-label':'Search memories',className:'search',placeholder:'Search memories…',value:query,onChange:e=>setQuery(e.target.value)}),h('select',{'aria-label':'Memory status',value:status,onChange:e=>setStatus(e.target.value)},h('option',{value:''},'All statuses'),...['proposed','confirmed','superseded','rejected'].map(s=>h('option',{key:s,value:s},labels[s]))),h('select',{'aria-label':'Memory kind',value:kind,onChange:e=>setKind(e.target.value)},h('option',{value:''},'All types'),...(globalScope?globalKinds:kinds).map(k=>h('option',{key:k,value:k},labels[k])))),
     !loading&&!records.length&&!draft?h('div',{className:'card empty'},h('div',{className:'empty-icon','aria-hidden':true},'◈'),h('h2',null,globalScope?'Memories for every project':'Give your assistant a head start'),h('p',null,globalScope?'Save a writing style, tone, or a stable fact about you once, and every project receives it.':'Save project facts, decisions, and preferences so you don’t have to repeat them in every conversation.'),h(Button,{onClick:newDraft,className:'primary'},globalScope?'Create a global memory':'Create your first memory'),h('p',{className:'onboarding-hint small'},'Or say ',h('code',null,globalScope?'Always write at a high school reading level':'Remember: use pnpm for this project'))):h('div',{className:'grid'+(!records.length?' editor-only':''),'aria-busy':loading},
      records.length>0&&h('aside',{className:'card list-card','aria-label':'Saved memories'},h('div',{className:'list-heading'},filtered.length+(filtered.length===1?' memory':' memories')+(filtered.length!==records.length?' of '+records.length:'')),!filtered.length&&h('div',{className:'small muted',style:{padding:12}},query||status||kind?'No matches. Try another search or clear your filters.':'Your saved memories will appear here.',(query||status||kind)&&h('div',{style:{marginTop:12}},h(Button,{onClick:()=>{setQuery('');setStatus('');setKind('');}},'Clear filters'))),h('div',{className:'list'},...filtered.map(r=>h('div',{key:r.id,className:'record-row'},h('button',{type:'button',className:'record record-open','aria-pressed':r.id===selected,onClick:()=>{setSelected(r.id);setDraft(null);setDeleting(false);setNotice('');}},h('strong',null,r.title),h('span',{className:'record-preview'},r.content),h('span',{className:'row'},h('span',{className:'pill','data-tone':r.status},labels[r.status]),h('span',{className:'small'},labels[r.kind]),r.pinned&&h('span',{className:'small'},'Pinned'),!r.enabled&&h('span',{className:'small'},'Disabled'),r.expiresAt&&Date.parse(r.expiresAt)<=Date.now()&&h('span',{className:'small'},'Expired'))),h('button',{type:'button',className:'record-delete',disabled:busy,'aria-label':'Delete memory: '+r.title,title:'Delete '+r.title,onClick:()=>{setSelected(r.id);setDraft(null);setNotice('');setDeleting(true);}},'✕'))))),
      h('article',{className:'card detail'+(!draft&&!current?' detail-empty':''),'aria-label':draft?'Memory editor':'Memory details'},draft?editor():current?detail():h('div',{className:'empty'},h('h2',null,'Select a memory'),h('p',{className:'small'},'Review its content, manage reuse, or explore its history.')))),
     globalScope&&h('div',{className:'card diagnostics'},h('p',{className:'diag-note'},'Global memories join every project’s requests; a workspace entry overrides one when the two conflict. Context preview, settings and per-turn activity stay per workspace, so open a workspace above to inspect them.'),h('div',{className:'section'},h('h3',null,records.length+' global '+(records.length===1?'memory':'memories')),h('p',{className:'small muted'},'Unpin one to let it apply only when a request matches it.'))),
     !globalScope&&h('details',{className:'card diagnostics'},h('summary',null,'Context preview & activity'),h('p',{className:'diag-note'},'Pinned memories come first, then keyword matches. Preview ranks by meaning when the local model is available, and by keywords otherwise. It uses the search above; requests use recent session messages and the selected scope’s settings.'),btn('Preview context',async()=>setPreview(await api('preview',{workspaceId,...sessionId?{sessionId}:{},query})),undefined,'Context preview updated.'),preview&&h('div',{className:'section'},h('h3',null,preview.records.length+' memories · '+preview.usedChars.toLocaleString()+' characters'),!preview.records.length&&h('p',{className:'small muted'},'No memories would be included for this query and scope.'),...preview.records.map(r=>h('p',{key:r.id},r.title,h('span',{className:'muted small'},' · revision '+r.revision+' · '+(preview.reasons.find(x=>x.id===r.id)?.reason??'')))),preview.overflow.reasons.length>0&&h('p',null,preview.overflow.reasons.length+' memories omitted by budget or limit.'),h('details',null,h('summary',null,'Technical selection details'),h('pre',null,JSON.stringify({selected:preview.records.map(r=>({id:r.id,title:r.title,revision:r.revision})),reasons:preview.reasons,overflow:preview.overflow.reasons,usedChars:preview.usedChars},null,2)))),h('div',{className:'section'},h('h3',null,'Recent activity'),!uses.length&&h('p',{className:'small muted'},'No request activity recorded for this scope yet.'),h('div',{className:'usage-list'},...uses.map(u=>h('details',{key:u.sessionId+':'+u.turn+':'+u.step},h('summary',null,'Turn '+u.turn+' · Step '+u.step+' · '+u.selected.length+' included'),h('div',{className:'muted small'},new Date(u.at).toLocaleString()+' · '+u.state),h('pre',null,JSON.stringify(u,null,2))))))),
     h('p',{className:'footer'},'Only approved, enabled, unexpired memories can be reused. Deleting or disabling memory does not retract context already sent to a model.'))));
  }
  function Header({sessionId}){const [error,setError]=React.useState('');return h('span',{className:'wm-mini'},h('button',{type:'button',title:'Open workspace memory and session controls',onClick:()=>open(sessionId).catch(e=>setError(e.message))},'Memory'),error&&h('span',{role:'alert'},error));}
  function Disclosure({sessionId,turn:location}){
   const turn=typeof location==='number'?location:location?.turn;const [data,setData]=React.useState([]),[error,setError]=React.useState('');
   React.useEffect(()=>{let alive=true;async function refresh(){if(!Number.isInteger(turn))return;try{const ws=await api('workspaces');const w=ws.find(w=>w.sessionIds.includes(sessionId));if(!w)return;const rows=await api('usage',{workspaceId:w.id,sessionId,turn});if(alive){setData(rows);setError('');}}catch(e){if(alive)setError(e.message);}}refresh();const id=setInterval(refresh,10000);window.addEventListener('workspace-memory-changed',refresh);return()=>{alive=false;clearInterval(id);window.removeEventListener('workspace-memory-changed',refresh);};},[sessionId,turn]);
   if(!data.length&&!error)return null;
   const unique=new Set(data.flatMap(u=>u.selected.map(r=>r.id))),allOff=data.length>0&&data.every(u=>!u.enabled),omitted=data.reduce((n,u)=>n+u.overflow.length,0);
   const semantic=data.filter(u=>u.retrieval==='semantic').length,fallback=data.filter(u=>u.retrieval==='fallback').length;
   const summary=error?'Disclosure unavailable':allOff?'Memory off':unique.size?unique.size+(unique.size===1?' memory used':' memories used'):'No memories used';
   const mode=allOff?'':semantic&&!fallback?'Found by meaning.':fallback?'Keyword matching was used because the local embedding model was unavailable.':semantic?'Found by meaning for some steps and keywords for others.':'Matched by keywords.';
   return h('div',{className:'wm-mini'},h('details',{className:'wm-disclosure'},h('summary',null,h('strong',null,'Memory'),h('span',null,' · '+summary)),h('div',{className:'disclosure-body'},error&&h('p',{role:'alert'},error),!error&&h('p',null,allOff?'Automatic memory was disabled for these steps.':unique.size?unique.size+' distinct '+(unique.size===1?'memory was':'memories were')+' selected across '+data.length+' steps.':'No eligible memories were included across '+data.length+' steps.'),!error&&mode&&h('p',null,mode),omitted>0&&h('p',null,omitted+' selections omitted by the context budget or limit.'),data.length>0&&h('details',null,h('summary',null,'Step-by-step log ('+data.length+')'),h(StepLog,{rows:data})),h('div',{className:'disclosure-actions'},h('button',{type:'button',onClick:()=>open(sessionId).catch(e=>setError(e.message))},'Review memory'),h('span',{className:'disclosure-note'},'“Started” means invocation began, not confirmed delivery.')))));
  }
  function SaveMessage({sessionId,messageId}){const [error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);return h('span',{className:'wm-mini'},h('button',{type:'button',title:'Create a reviewable memory linked to this reply',disabled:busy,onClick:async()=>{setBusy(true);setError('');try{await open(sessionId,freshDraft({session:sessionId,message:messageId,origin:'message-action'}));}catch(e){setError(e.message);}finally{setBusy(false);}}},'Remember…'),error&&h('span',{role:'alert'},error));}
  slots.inject('main',()=>slots.register({name:'main',key:'workspace-memory'},Panel));
  slots.inject('sidebar.panellist',()=>slots.register({name:'sidebar.panellist',id:'workspace-memory',order:15,label:'Workspace memory'},()=>h('span',{'aria-label':'Workspace memory',title:'Workspace memory',style:{fontSize:19}},'◈')));
  slots.inject('conversation.session.header.utilities',()=>slots.register({name:'conversation.session.header.utilities',id:'workspace-memory',order:15,inject:sessionId=>({sessionId})},Header));
  slots.inject('conversation.chat.turnTail',()=>slots.register({name:'conversation.chat.turnTail',id:'workspace-memory-disclosure',order:30,inject:sessionId=>({sessionId})},Disclosure));
  slots.inject('conversation.chat.assistant-actions',()=>slots.register({name:'conversation.chat.assistant-actions',id:'workspace-memory-save',order:30,inject:sessionId=>({sessionId})},SaveMessage));
 }
 return {apply,inject:['slots','layout']};
}});
