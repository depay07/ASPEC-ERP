import assert from 'node:assert/strict';
import project from '../aspec-cloud/project.json' with {type:'json'};

const headers={apikey:project.anonKey,Authorization:'Bearer '+project.anonKey,'Content-Type':'application/json'};
for(const table of ['sales','purchase_orders','partners','calendar_events']) {
 const r=await fetch(project.url+'/rest/v1/'+table+'?select=id&limit=1',{headers,redirect:'manual'});
 assert.ok([401,403].includes(r.status),table+': anonymous access must be denied');
 console.log('PASS anonymous table access denied:',table,r.status);
}
for(const fn of ['get_shared_sale','get_shared_purchase_order']) {
 const r=await fetch(project.url+'/rest/v1/rpc/'+fn,{method:'POST',headers,body:JSON.stringify({p_token:'0'.repeat(64)}),redirect:'manual'});
 assert.equal(r.status,200);
 assert.equal(await r.json(),null);
 console.log('PASS invalid share token returns no document:',fn);
}
for(const bucket of ['erp','memos']) {
 const r=await fetch(project.url+'/storage/v1/object/list/'+bucket,{method:'POST',headers,body:JSON.stringify({prefix:'',limit:1}),redirect:'manual'});
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),[]);
 console.log('PASS anonymous file enumeration denied:',bucket);
}
for(const [file,marker] of [['erp.html','js/private-storage.js'],['po-view.html','get_shared_purchase_order'],['trade-statement.html','get_shared_sale']]) {
 const r=await fetch('https://erp.aspec-tech.co.kr/'+file+'?security-check='+Date.now(),{redirect:'manual'});
 assert.equal(r.status,200);
 assert.ok((await r.text()).includes(marker),'Deployment not ready: '+file);
 console.log('PASS deployed frontend:',file);
}
