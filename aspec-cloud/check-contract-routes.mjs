// Check the actual reverse proxy: fetch follows redirects by default and can hide CORS failures.
import assert from 'node:assert/strict';
const base=(process.argv[2]||'https://api.aspec-tech.co.kr').replace(/\/$/,'');
const origin=process.argv[3]||'https://erp.aspec-tech.co.kr';
for(const requestedMethod of ['GET','POST']) {
 const preflight=await fetch(base+'/cloud/contracts?q=&archived=0&page=0',{
  method:'OPTIONS',redirect:'manual',headers:{Origin:origin,
   'Access-Control-Request-Method':requestedMethod,
   'Access-Control-Request-Headers':requestedMethod==='POST'?'authorization,content-type':'authorization'}
 });
 assert.equal(preflight.status,204,requestedMethod+' preflight must not redirect');
 assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
 assert.equal(preflight.headers.get('access-control-allow-credentials'),'true');
 assert.equal(preflight.headers.get('location'),null);
 const request=await fetch(base+'/cloud/contracts',{
  method:requestedMethod,redirect:'manual',headers:{Origin:origin,...(requestedMethod==='POST'?{'Content-Type':'application/json'}:{})},
  ...(requestedMethod==='POST'?{body:'{}'}:{})
 });
 assert.equal(request.status,401,requestedMethod+' must reach authentication without redirecting');
 assert.equal(request.headers.get('access-control-allow-origin'),origin);
 assert.equal(request.headers.get('location'),null);
 console.log('PASS: '+requestedMethod+' preflight 204; unauthenticated request 401; no redirects');
}
