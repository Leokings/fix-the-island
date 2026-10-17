// Public-origin integration probe: fake read-only account provider, REAL RPC.
// This never signs and is NOT evidence of browser-wallet signing or consensus.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
try{
  await page.addInitScript(()=>{
    window.__probeRequests=[];
    window.ethereum={request:async({method})=>{
      window.__probeRequests.push(method);
      if(method==='eth_requestAccounts'||method==='eth_accounts')return['0x797d3b25fb2cca0ff93f60df1910267f3822d655'];
      if(method==='eth_chainId')return'0x107d';
      throw new Error('Read-only probe refuses '+method);
    },on(){},removeListener(){}};
  });
  await page.goto(process.argv[2],{waitUntil:'networkidle',timeout:60000});
  await page.locator('#connected').click();
  await page.waitForFunction(()=>{try{return JSON.parse(document.querySelector('#world').dataset.domainState).mode==='connected'}catch{return false}},{},{timeout:120000});
  const result=await page.evaluate(()=>({requests:window.__probeRequests,state:JSON.parse(document.querySelector('#world').dataset.domainState),text:document.body.innerText.slice(0,900)}));
  assert.ok(result.requests.every(x=>['eth_requestAccounts','eth_accounts','eth_chainId'].includes(x)));
  assert.equal(result.state.mode,'connected');
  const report={passed:true,url:process.argv[2],scope:'Read-only account-provider stub with actual Bradbury RPC source/protocol verification; no signing or consensus claim.',requests:result.requests,mode:result.state.mode,text:result.text};
  writeFileSync('artifacts/deployment/hosted-readonly-connection.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}catch(error){console.error((await page.locator('body').innerText()).slice(0,1600));throw error;}finally{await browser.close()}
