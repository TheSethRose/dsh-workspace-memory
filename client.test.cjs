'use strict';
// Lightweight component-contract tests; live browser checks cover layout and focus.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function renderDisclosure(rows,error=''){
 const components=new Map(),effects=[];let state=0;
 const React={Fragment:Symbol('fragment'),createElement:(type,props,...children)=>({type,props:{...props,children}}),useState:()=>[[rows,error][state++],()=>{}],useEffect:(fn,deps)=>effects.push({fn,deps})};
 let plugin;
 const window={__ModuleLoader__:{load:module=>{plugin=module.factory(name=>{assert.equal(name,'react');return React;});}},addEventListener(){},removeEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'client.js'),'utf8'),{window,document:{createElement:()=>({})}});
 plugin.apply({effect(){},get:name=>name==='layout'?{selectPanel(){}}:{inject(_slot,fn){fn();},register(spec,component){components.set(spec.id??spec.key,component);}}});
 const tree=components.get('workspace-memory-disclosure')({sessionId:'session-a',turn:{turn:0}});
 function nodes(value){if(value==null||value===false)return [];if(Array.isArray(value))return value.flatMap(nodes);if(typeof value!=='object')return [value];if(typeof value.type==='function')return nodes(value.type(value.props));return [value,...nodes(value.props.children)];}
 const all=nodes(tree),text=value=>nodes(value).filter(n=>typeof n==='string'||typeof n==='number').join('');
 return {all,text,effects};
}
const row=(step,selected=[],enabled=true)=>({sessionId:'session-a',turn:0,step,state:'started',selected,enabled,usedChars:selected.length*100,overflow:[]});
test('empty memory activity is summarized with a collapsed detailed log',()=>{
 const r=renderDisclosure(Array.from({length:11},(_,i)=>row(i+1)));
 const disclosure=r.all.find(n=>n.props?.className==='wm-disclosure');
 assert.equal(r.text(disclosure.props.children[0]),'Memory · No memories used');
 assert.equal(disclosure.props.open,undefined);
 const logs=r.all.filter(n=>n.type==='details');
 assert.equal(logs.length,2);
 assert.equal(logs[1].props.open,undefined);
 assert.match(r.text(logs[1].props.children[0]),/Step-by-step log \(11\)/);
 assert.equal(r.all.filter(n=>n.props?.className==='step-row').length,11);
 assert.deepEqual(Array.from(r.effects[0].deps),['session-a',0]);
});
test('disclosure counts distinct memories, not repeated step selections',()=>{
 const selection=[{id:'one',revision:2,reason:'pinned'}];
 const r=renderDisclosure([row(1,selection),row(2,selection)]);
 assert.match(r.text(r.all.find(n=>n.type==='summary')),/1 memory used/);
 assert.match(r.text(r.all),/1 distinct memory was selected across 2 steps/);
 assert.match(r.text(r.all),/revision 2 · pinned/);
});
test('disabled memory activity and errors remain transparently disclosed',()=>{
 assert.match(renderDisclosure([row(1,[],false)]).text(renderDisclosure([row(1,[],false)]).all),/Memory off/);
 const r=renderDisclosure([], 'Request failed');
 assert.match(r.text(r.all),/Disclosure unavailable/);
 assert.equal(r.text(r.all.find(n=>n.props?.role==='alert')),'Request failed');
});
test('a turn without recorded activity adds no empty disclosure',()=>{
 assert.equal(renderDisclosure([]).all.length,0);
});
// Global scope is a first-class scope in the panel: selecting it must ask the
// service for global records and must never send a workspace id with them.
function renderPanel(selected,{draft=null,records=[],config=null}={}){
 const components=new Map(),bodies=[];
 const values=[[],selected,'',records,'','','',null,draft,config,[],null,'','',false,false,0,false,null];
 let index=0;
 const React={Fragment:Symbol('fragment'),createElement:(type,props,...children)=>({type,props:{...props,children}}),useState:()=>[values[index++],()=>{}],useEffect:fn=>{fn();}};
 let plugin;
 const window={__ModuleLoader__:{load:module=>{plugin=module.factory(name=>{assert.equal(name,'react');return React;});}},addEventListener(){},removeEventListener(){},dispatchEvent(){}};
 const fetch=async(_url,options)=>{bodies.push(JSON.parse(options.body));return {ok:true,json:async()=>({result:[]})};};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'client.js'),'utf8'),{window,document:{createElement:()=>({})},fetch,console});
 plugin.apply({effect(){},get:name=>name==='layout'?{selectPanel(){}}:{inject(_slot,fn){fn();},register(spec,component){components.set(spec.name+':'+(spec.id??spec.key),component);}}});
 const tree=components.get('main:workspace-memory')({});
 function nodes(value){if(value==null||value===false)return [];if(Array.isArray(value))return value.flatMap(nodes);if(typeof value!=='object')return [value];if(typeof value.type==='function')return nodes(value.type(value.props));return [value,...nodes(value.props.children)];}
 return {all:nodes(tree),bodies,text:value=>nodes(value).filter(n=>typeof n==='string').join('')};
}
const settings={enabled:true,suggestions:true,budgetChars:8000,excluded:[],semantic:false,semanticThreshold:0.55};
const draft=kind=>({title:'',content:'',kind,pinned:false,enabled:true,expiresAt:null,supersedes:null,source:{}});
test('selecting the global scope requests global records and never a workspace id',()=>{
 const r=renderPanel('global');
 const list=r.bodies.find(b=>b.operation==='list');
 assert.deepEqual(list.args,{scope:'global'});
 for(const body of r.bodies) assert.equal(Object.hasOwn(body.args??{},'workspaceId'),false,'global requests must not name a workspace');
 assert.ok(!r.bodies.some(b=>b.operation==='settings'||b.operation==='usage'),'settings and activity stay per workspace');
 const options=r.all.filter(n=>n.type==='option').map(n=>n.props.value);
 assert.ok(options.includes('global'));
 const path=r.all.find(n=>typeof n.props?.className==='string'&&n.props.className.startsWith('path'));
 assert.match(r.text(path),/project entry overrides it/);
 assert.match(r.text(r.all),/Applies to every project/);
});
test('a global editor only offers cross-project kinds',()=>{
 const kindSelect=renderPanel('global',{draft:draft('instruction'),records:[]}).all.find(n=>n.type==='select'&&n.props['aria-label']==='Memory entry kind');
 assert.deepEqual(kindSelect.props.children.map(o=>o.props.value),['instruction','fact']);
 const workspaceKinds=renderPanel('workspace-a',{draft:draft('fact'),config:settings}).all.find(n=>n.type==='select'&&n.props['aria-label']==='Memory entry kind');
 assert.deepEqual(workspaceKinds.props.children.map(o=>o.props.value),['instruction','fact','decision','working-state']);
});
test('a workspace scope still sends its workspace id and loads its own settings',()=>{
 const r=renderPanel('workspace-a',{config:settings});
 assert.equal(r.bodies.find(b=>b.operation==='list').args.workspaceId,'workspace-a');
 assert.ok(r.bodies.some(b=>b.operation==='settings')&&r.bodies.some(b=>b.operation==='usage'),'workspace scope loads settings and activity');
 assert.ok(!r.bodies.some(b=>b.args?.scope),'workspace requests carry no global scope');
});

// A stateful mount so the delete flow can actually be clicked through: real
// useState setters, re-render on change, effects on mount only.
function mountPanel(scope,{records=[],config=null,draft=null,selected=records[0]?.id??null}={}){
 const components=new Map(),bodies=[],effects=[],state=[];
 let cursor=0,pending=false,mounted=false,tree=null;
 const React={
  Fragment:Symbol('fragment'),
  createElement:(type,props,...children)=>({type,props:{...props,children}}),
  useState:initial=>{const index=cursor++;if(!(index in state))state[index]=initial;return [state[index],next=>{state[index]=typeof next==='function'?next(state[index]):next;pending=true;}];},
  useEffect:fn=>{if(!mounted)effects.push(fn);},
 };
 let plugin;
 const window={__ModuleLoader__:{load:module=>{plugin=module.factory(name=>{assert.equal(name,'react');return React;});}},addEventListener(){},removeEventListener(){},dispatchEvent(){}};
 const fetch=async(_url,options)=>{bodies.push(JSON.parse(options.body));return {ok:true,json:async()=>({result:[]})};};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'client.js'),'utf8'),{window,document:{createElement:()=>({})},fetch,console});
 plugin.apply({effect(){},get:name=>name==='layout'?{selectPanel(){}}:{inject(_slot,fn){fn();},register(spec,component){components.set(spec.name+':'+(spec.id??spec.key),component);}}});
 const Panel=components.get('main:workspace-memory');
 // Hook order is fixed by the panel: 0 workspaces, 1 workspaceId, 2 sessionId,
 // 3 records, 9 config. Seeding them is how a mounted session is simulated.
 state[0]=[{id:'workspace-a',title:'A',path:'/a',sessionIds:['session-a']},{id:'workspace-b',title:'B',path:'/b',sessionIds:['session-b']}];
 state[1]=scope;state[3]=records;state[7]=selected;state[9]=config;
 const draw=()=>{cursor=0;pending=false;const next=Panel({});if(!mounted){mounted=true;for(const fn of effects)fn();}return next;};
 tree=draw();while(pending)tree=draw();
 function nodes(value,out=[]){if(value==null||value===false||value===true)return out;if(Array.isArray(value)){for(const item of value)nodes(item,out);return out;}if(typeof value!=='object'){out.push(value);return out;}if(typeof value.type==='function')return nodes(value.type(value.props),out);out.push(value);return nodes(value.props.children,out);}
 const text=value=>nodes(value).filter(n=>typeof n==='string'||typeof n==='number').join('');
 const findBy=predicate=>nodes(tree).find(predicate);
 const click=node=>{assert.ok(node,'node to click must exist');node.props.onClick({preventDefault(){},stopPropagation(){}});while(pending)tree=draw();};
 return {bodies,findBy,click,text};
}
function memory(extra={}){
 return {id:'r1',workspaceId:'workspace-a',title:'Orchard apples',content:'Use orchard apples.',kind:'fact',status:'confirmed',enabled:true,pinned:false,source:{origin:'user-request'},expiresAt:null,supersedes:null,revision:2,createdAt:'2026-10-04T00:00:00.000Z',updatedAt:'2026-10-04T00:00:00.000Z',history:[],...extra};
}
test('every memory offers delete, and nothing is removed before confirmation',()=>{
 const record=memory(),p=mountPanel('workspace-a',{records:[record],config:settings});
 const byText=label=>p.findBy(n=>n.type==='button'&&p.text(n)===label);
 const rowDelete=p.findBy(n=>typeof n.props?.['aria-label']==='string'&&n.props['aria-label']==='Delete memory: '+record.title);
 assert.ok(rowDelete,'each list row offers a delete control');
 assert.ok(byText('Delete'),'the detail action row offers Delete without opening a collapsed section');
 p.click(rowDelete);
 assert.ok(!p.bodies.some(b=>b.operation==='remove'),'clicking delete must not remove anything yet');
 const confirm=p.findBy(n=>n.props?.className==='card delete-confirm');
 assert.ok(confirm,'a confirmation card appears');
 assert.match(p.text(confirm),/Delete this memory permanently\?/);
 assert.match(p.text(confirm),/not source chats or previously sent requests/);
 p.click(byText('Keep memory'));
 assert.ok(!p.bodies.some(b=>b.operation==='remove'),'cancelling removes nothing');
 p.click(byText('Delete'));
 assert.ok(p.findBy(n=>n.props?.className==='card delete-confirm'),'the detail Delete also confirms first');
 p.click(byText('Delete permanently'));
 assert.deepEqual(p.bodies.filter(b=>b.operation==='remove'),[{operation:'remove',args:{workspaceId:'workspace-a',id:record.id,expectedRevision:record.revision}}]);
});
test('deleting a global memory never names a workspace',()=>{
 const record=memory({workspaceId:'global',id:'g1'}),p=mountPanel('global',{records:[record]});
 p.click(p.findBy(n=>n.type==='button'&&p.text(n)==='Delete'));
 p.click(p.findBy(n=>n.type==='button'&&p.text(n)==='Delete permanently'));
 const removal=p.bodies.find(b=>b.operation==='remove');
 assert.deepEqual(removal.args,{scope:'global',id:'g1',expectedRevision:2});
 assert.equal(Object.hasOwn(removal.args,'workspaceId'),false);
});
