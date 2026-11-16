const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = require('./helpers/html.cjs');
const root = path.resolve(__dirname,'..');
const read = file => readFileSync(path.join(root,file),'utf8');
const attack = '\"><img src=x onerror=alert(1)><svg onload=alert(2)>\'';

function harness(file, name, extra={}) {
 const elements = new Map();
 const context = vm.createContext({
  ...html, URL, console,
  AppState:{globalDataStore:{},tempItems:[],currentYear:2026,currentMonth:10,calendarEvents:[]},
  document:{getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:'',value:''});return elements.get(id);}},
  storeRowData:()=> 'row-safe', formatNumber:String, getToday:()=> '2026-11-15',
  showEmptyTable(){}, ...extra
 });
 vm.runInContext(read(file)+`\nthis.moduleUnderTest=${name};`,context);
 return {module:context.moduleUnderTest,context,elements};
}

test('private files accept legacy URLs and durable paths, reject foreign URLs and traversal',async()=>{
 const calls=[];
 const h=harness('js/private-storage.js','PrivateStorage',{
  SUPABASE_URL:'https://example.supabase.co',
  supabaseClient:{storage:{from(bucket){return {async createSignedUrl(file,ttl){calls.push({bucket,file,ttl});return {data:{signedUrl:'https://example.supabase.co/storage/v1/object/sign/memos/a.png?token=test'}};}};}}}
 });
 assert.equal(h.module.pathFor('memos','https://example.supabase.co/storage/v1/object/public/memos/uploads/a%20b.png'),'uploads/a b.png');
 assert.equal(h.module.pathFor('erp','storage://erp/a.pdf'),'a.pdf');
 for(const value of ['javascript:alert(1)','https://evil.example/a.pdf','storage://erp/../secret','storage://erp/a\\b','https://example.supabase.co.evil.test/storage/v1/object/public/erp/a.pdf']) {
  assert.throws(()=>h.module.pathFor('erp',value));
 }
 await h.module.signedUrl('memos','storage://memos/uploads/a.png');
 assert.deepEqual(calls,[{bucket:'memos',file:'uploads/a.png',ttl:60}]);
 const link=h.module.link('erp','storage://erp/'+attack,'file','label');
 assert.ok(!link.includes('<img'));
 assert.equal(h.module.link('erp','javascript:alert(1)','file','label'),'');
});

test('file signing errors do not fall back to a public URL',async()=>{
 const h=harness('js/private-storage.js','PrivateStorage',{
  SUPABASE_URL:'https://example.supabase.co',
  supabaseClient:{storage:{from(){return {async createSignedUrl(){return {error:new Error('denied')};}};}}}
 });
 await assert.rejects(h.module.signedUrl('erp','storage://erp/a.pdf'),/denied/);
});

test('stored text is inert in ERP lists and meeting detail',()=>{
 const modules=[['products','ProductsModule'],['sales','SalesModule'],['orders','OrdersModule'],
  ['purchases','PurchasesModule'],['bookkeeping','BookkeepingModule'],['meeting-logs','MeetingLogsModule'],
  ['partners','PartnersModule'],['purchase-orders','PurchaseOrdersModule']];
 for(const [file,name] of modules){
  const h=harness('js/modules/'+file+'.js',name,{DocumentBaseModule:{},PrivateStorage:{link:()=>''}});
  const row={id:1,date:'2026-11-15',items:[{name:attack}],name:attack,code:attack,spec:attack,
   unit:attack,partner_name:attack,manager:attack,note:attack,po_number:attack,end_user:attack,
   attendees:attack,content:attack,next_step:attack,manufacturer:attack,item_name:attack,
   serial_no:attack,category:attack,usage_desc:attack,payment_method:attack,manager_name:attack,phone:attack};
  h.module.renderTable([row]);
  const output=h.elements.get('listBody').innerHTML;
  assert.ok(!output.includes('<img'),name+' contains executable markup');
  assert.ok(output.includes('&lt;img'),name+' lost the display text');
  if(name==='MeetingLogsModule')assert.ok(!h.module.getViewHtml(row,'row-safe').includes('<img'));
 }
});

test('public document pages request one token-protected RPC, never enumerate tables',async()=>{
 for(const [file,fn] of [['po-view.html','get_shared_purchase_order'],['trade-statement.html','get_shared_sale']]){
  const calls=[];
  const source=read(file);
  const script=source.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const context=vm.createContext({URLSearchParams,console,
   window:{location:{search:'?token=abc'}},
   document:{getElementById(){return {className:'',textContent:'',innerHTML:''};}},
   supabaseClient:{async rpc(name,args){calls.push({name,args});return {data:null,error:null};}}
  });
  vm.runInContext(script,context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls[0].name,fn);
  assert.equal(calls[0].args.p_token,'abc');
  assert.doesNotMatch(script,/\.from\(['"](?:sales|purchase_orders)['"]\)/);
  assert.match(source,/<meta name="referrer" content="no-referrer">/);
 }
});
