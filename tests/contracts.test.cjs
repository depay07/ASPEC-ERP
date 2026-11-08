const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');

async function harness({failSecond=false,deny=false}={}){
 const elements=new Map(),calls=[],alerts=[];let row=null,uploads=0,closed=false;
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',className:'',disabled:false});return elements.get(id);};
 const context=vm.createContext({Headers,URL,URLSearchParams,crypto:webcrypto,AppState:{currentTab:'contracts',partnerList:[]},
  document:{getElementById:element,querySelectorAll:()=>[]},supabaseClient:{auth:{getSession:async()=>({data:{session:{access_token:'private-session-token'}}})}},
  alert:m=>alerts.push(m),confirm:()=>true,openModal(){},closeModal(){closed=true;},window:{location:{},open:()=>({location:{},close(){}})},
  fetch:async(url,options)=>{
   calls.push({url,options});const p=new URL(url).pathname.replace('/cloud','');let data,status=200;
   if(deny){data={error:'권한이 없습니다.'};status=403;}
   else if(p==='/contracts'&&options.method==='POST'){row={...JSON.parse(options.body),id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',version:0,archived:0,files:[]};data={...row};}
   else if(p.endsWith('/files')&&options.method==='POST'){
    uploads++;if(failSecond&&uploads===2){data={error:'첨부 연결 오류'};status=503;}
    else{row.files.push({id:options.headers.get('X-Upload-Id'),name:decodeURIComponent(options.headers.get('X-File-Name')),size:options.body.size});row.version++;data={file:row.files.at(-1)};}
   }else if(p==='/contracts'){data={items:row?[{...row,file_count:row.files.length}]:[],total:row?1:0,page:0,pageSize:50};}
   else if(options.method==='PATCH'){row={...row,...JSON.parse(options.body),version:row.version+1};data={...row};}
   else{data={...row,files:[...(row?.files||[])]};}
   return {ok:status<400,status,json:async()=>data};
  }
 });
 vm.runInContext(readFileSync(require('node:path').join(__dirname,'../js/modules/contracts.js'),'utf8')+'\nthis.module=ContractsModule;',context);
 await context.module.init({innerHTML:''});
 return {module:context.module,element,calls,alerts,get row(){return row;},get closed(){return closed;}};
}
test('partial scan failure retries the same saved contract and only unfinished attachments',async()=>{
 const h=await harness({failSecond:true});h.module.openNew();
 h.element('contractTitle').value='서면 공급 계약';h.element('contractPartner').value='거래처';h.element('contractDate').value='2026-11-07';
 h.module.choose({files:[new File(['%PDF-first'],'첫 장.pdf'),new File(['%PDF-second'],'둘째 장.pdf')],value:''});
 await h.module.save();assert.equal(h.closed,false);assert.equal(h.row.files.length,1);assert.match(h.element('contractSaveStatus').textContent,/완료된 첨부는 저장/);
 await h.module.save();assert.equal(h.closed,true);assert.equal(h.row.files.length,2);
 assert.equal(h.calls.filter(c=>new URL(c.url).pathname==='/cloud/contracts'&&c.options.method==='POST').length,1);
 const attempts=h.calls.filter(c=>c.options.headers.has('X-Upload-Id'));
 assert.equal(attempts.length,3);assert.equal(attempts[1].options.headers.get('X-Upload-Id'),attempts[2].options.headers.get('X-Upload-Id'));
 assert.equal(attempts[0].options.headers.get('Authorization'),'Bearer private-session-token');assert.equal(attempts[0].options.credentials,'include');
 assert.ok(attempts.every(c=>!c.url.includes('private-session-token')));
});
test('contract names and notes are escaped in list HTML and rejected attachments are not uploaded',async()=>{
 const h=await harness();h.module.openNew();h.element('contractTitle').value='<img src=x onerror=alert(1)>';h.element('contractMemo').value='<script>bad</script>';
 h.module.choose({files:[new File(['MZ'],'bad.exe')],value:''});assert.equal(h.alerts.length,1);
 await h.module.save();assert.equal(h.row.files.length,0);
 assert.match(h.element('contractRows').innerHTML,/&lt;img/);assert.match(h.element('contractRows').innerHTML,/&lt;script&gt;/);
 assert.ok(!h.element('contractRows').innerHTML.includes('<img'));
});
test('permission failures remain visible instead of appearing as an empty successful list',async()=>{
 const h=await harness({deny:true});assert.match(h.element('contractNotice').textContent,/조회 실패.*권한/);
});
