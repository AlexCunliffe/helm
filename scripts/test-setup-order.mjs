import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const code=readFileSync(root+'/scripts/setup.mjs','utf8').replace('main().catch(error=>','await main().catch(error=>');
const areaCode=readFileSync(root+'/scripts/lib/areas.mjs','utf8');
const initialSettings={owner:{name:'Example',shortName:'Example',tone:'Concise'},founderContext:'',timezone:'UTC',workday:{start:'08:00',end:'17:00',days:[1,2,3,4,5]},sources:[],hook:{logSessions:false,includeCwd:false,titleChars:140}};
const initialAreas=[['work','Work'],['finance','Finance'],['people','People'],['admin','Admin'],['home','Home'],['personal','Personal']].map(([key,label],order)=>({key,label,order,color:'#123456',_id:'mock-'+key,_creationTime:1}));
async function scenario(dryRun,customOrder=false,append=false){
 const settings=structuredClone(initialSettings),areas=structuredClone(initialAreas),calls=[],output=[];
 if(customOrder)for(const a of areas)a.order=100-a.order*10;
 const expected=areas.map(a=>[a.key,a.order]);let adds=0;
 const snapshot=()=>({settings,areas:[...areas].sort((a,b)=>a.key.localeCompare(b.key)),hasSettings:true,hasApiKey:true,hasSurfaceToken:true,hasAnthropicKey:false});
 const dev={name:'mock-development',url:'https://mock-development.convex.cloud',getKey:()=> 'mock-not-a-secret',cli(args){calls.push(args);if(args[0]==='run'&&args[1]==='setup:snapshot')return JSON.stringify(snapshot());if(args[0]==='run'&&args[1]==='setup:validate')return 'null';if(args[0]==='env'&&args[1]==='remove')return '';throw new Error('Unexpected mock CLI operation');}};
 class Client{async mutation(name,args){calls.push(['mutation',name,args]);if(name==='settings:update')Object.assign(settings,args.patch);else if(name==='areas:upsertArea'){const item=areas.find(a=>a.key===args.key);const {apiKey,...patch}=args;if(item)Object.assign(item,patch);else areas.push(patch);}else throw new Error('Unexpected mock mutation');}}
 const ctx=vm.createContext({console:{log:(...a)=>output.push(a.join(' ')),error:(...a)=>output.push(a.join(' '))},process:{argv:['node','setup.mjs',...(dryRun?['--dry-run']:[])],stdin:{isTTY:true},exitCode:0},Intl});
 const synthetic=(exports)=>new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v);},{context:ctx});
 const modules={
 'node:fs':synthetic({readFileSync:()=>{throw new Error('Unexpected file read');}}),
 'convex/browser':synthetic({ConvexHttpClient:Client}),'convex/server':synthetic({makeFunctionReference:x=>x}),
 './lib/dev.mjs':synthetic({development:()=>dev}),
 './lib/areas.mjs':new vm.SourceTextModule(areaCode,{context:ctx}),
 './lib/sources.mjs':synthetic({SOURCE_PRESETS:[]}),
 './lib/keys.mjs':synthetic({mintKey:()=>{throw new Error('Unexpected key generation');},setSecret:()=>{throw new Error('Unexpected secret write');}}),
 './lib/prompts.mjs':synthetic({prompts:()=>({ask:async(label,value='')=>label==='Enter a lowercase area key'?'extra':label==='Enter the area label'&&!value?'Extra':value,confirm:async label=>label.startsWith('Approve ')||(label==='Add another area? [y/N]'&&append&&adds++===0),close:()=>{}})}),
 './seed.mjs':synthetic({seedAreas:()=>{throw new Error('Unexpected seed');}})
 };
 const entry=new vm.SourceTextModule(code,{context:ctx});await entry.link(specifier=>{if(!modules[specifier])throw new Error('Unexpected import '+specifier);return modules[specifier];});await entry.evaluate();
 assert.equal(ctx.process.exitCode,0,output.join('\n'));
 const validated=JSON.parse(calls.find(c=>c[1]==='setup:validate')[2]).areas;
 assert.deepEqual(areas.filter(a=>a.key!=='extra').map(a=>[a.key,a.order]),expected,'retained orders stay unchanged');
 assert.deepEqual(validated.filter(a=>a.key!=='extra').map(a=>[a.key,a.order]),[...expected].sort((a,b)=>a[1]-b[1]),'review uses display order');
 if(append)assert.equal(validated.at(-1).order,Math.max(...expected.map(a=>a[1]))+1,'new area follows the largest retained order');
 if(dryRun)assert.ok(calls.every(a=>a[0]==='run'&&['setup:snapshot','setup:validate'].includes(a[1])),'dry run makes no writes');
 else assert.equal([...areas].sort((a,b)=>a.order-b.order)[0].key,[...expected].sort((a,b)=>a[1]-b[1])[0][0],'default area stays unchanged');
}
for(const dryRun of [true,false])for(const customOrder of [true,false])for(const append of [true,false])await scenario(dryRun,customOrder,append);
console.log('Interactive wizard ordering passed: unchanged reruns, custom order, additions, defaults, and dry-run preservation.');
