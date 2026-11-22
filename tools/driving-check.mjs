// Two real device contexts. Delay ordered control packets and authority snapshots independently.
import { chromium } from 'playwright';
import { createGameServer } from '../server/server.js';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const dir = process.env.EVIDENCE_DIR || 'work/driving-contact';
await mkdir(dir,{recursive:true});
const server = process.env.BASE_URL ? null : await createGameServer();
const url = process.env.BASE_URL || 'http://127.0.0.1:'+server.port;
const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',
  args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const errors=[];
try {
  async function player(name,invite) {
    const p = await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
    p.on('pageerror',e=>errors.push(e.message));
    await p.goto(invite || url);
    await p.evaluate(async()=>{
      const {Network}=await import('/js/network.js');
      const {AiController}=await import('/js/ai.js');
      const {Car}=await import('/js/car.js');
      const {apply,send,predict}=Network.prototype;
      let lastSend=0,lastRecv=0,bot;
      const stat=window.sample={frames:[],impact:[],bytes:0,snaps:0,history:0,maxLead:0,corrections:[]};
      let previous=0;
      function frame(t){ if(previous && window.net?.room?.phase==='racing')stat.frames.push(t-previous);previous=t;requestAnimationFrame(frame); }
      requestAnimationFrame(frame);
      Network.prototype.send=function(m){
        if(m.type!=='input')return send.call(this,m);
        const now=performance.now();
        lastSend=Math.max(lastSend+.1,now+55+22*Math.sin(m.seq*.09));
        setTimeout(()=>send.call(this,m),lastSend-now);
        return true;
      };
      Network.prototype.apply=function(snapshot){
        const now=performance.now();
        lastRecv=Math.max(lastRecv+.1,now+34+14*Math.sin(snapshot.tick*.12));
        setTimeout(()=>{
          apply.call(this,snapshot);window.net=this;
          stat.snaps++;stat.bytes+=JSON.stringify(snapshot).length;
          if(snapshot.cars.every(c=>c.impactTick>0) && Math.abs(snapshot.cars[0].impactTick-snapshot.cars[1].impactTick)<=1 &&
              Math.hypot(snapshot.cars[0].x-snapshot.cars[1].x,snapshot.cars[0].y-snapshot.cars[1].y)<85) {
            const tick=snapshot.cars[0].impactTick;
            if(!stat.impact.includes(tick))stat.impact.push(tick);
          }
          stat.history=Math.max(stat.history,this.pending.length);
          if(this.correction)stat.corrections.push(Math.hypot(this.correction.x,this.correction.y));
        },lastRecv-now);
      };
      Network.prototype.predict=function(input){
        const c=this.predicted;
        if(window.drive && c && !c.finished) {
          bot ||= new AiController(new Car(c.id,c.x,c.y,c.angle,{isHuman:false}),.75);
          Object.assign(bot.car,c,{isHuman:false});
          bot.update(1/60);input=bot.car.input;
        }
        const result = predict.call(this,input);
        if (this.latest && this.predicted) stat.maxLead=Math.max(stat.maxLead,this.predicted.tick-this.latest.tick);
        return result;
      };
    });
    if(invite)await p.locator('[data-language=en]').click();
    await p.locator('#nickname').fill(name);await p.locator('#nicknameForm button').tap();
    return p;
  }
  const a=await player('سالم');await a.locator('#btn-multiplayer').tap();
  await a.locator('.room-task summary').first().tap();await a.locator('#roomPrivacy').selectOption('private');
  await a.locator('#createForm button').tap();await a.locator('#lobbyScreen').waitFor({state:'visible'});
  const b=await player('Maha',await a.locator('#inviteLink').inputValue());await b.locator('#lobbyScreen').waitFor({state:'visible'});
  await a.locator('#btn-room-start').tap();await b.locator('#btn-room-start').tap();
  await a.waitForFunction(()=>window.net?.latest?.cars[0].speed>160);
  const cdp=await a.context().newCDPSession(a);
  async function pt(id,n){const box=await a.locator(id).boundingBox();return {x:box.x+box.width/2,y:box.y+box.height/2,id:n};}
  const right=await pt('#btn-right',1), brake=await pt('#btn-brake',2), turbo=await pt('#hud-turbo',3);
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  await touch('touchStart',[right]);
  await a.waitForFunction(()=>sample.impact.length>0,null,{timeout:5000});
  await touch('touchStart',[right,brake]);
  await a.waitForFunction(()=>net.predicted.input.brake===1 && net.predicted.input.steer===1);
  await touch('touchEnd',[]);await touch('touchStart',[right,turbo]);
  await a.waitForFunction(()=>net.latest.cars[0].turboUses===1);
  await touch('touchEnd',[]);
  for(const p of [a,b])await p.evaluate(()=>{window.drive=true});
  await a.waitForTimeout(1600);
  await a.screenshot({path:dir+'/landscape-ar.png'});
  await b.setViewportSize({width:390,height:844});await b.screenshot({path:dir+'/portrait-en.png'});
  if(process.env.CAPTURE_FRAMES){
    for(let i=0;i<28;i++){await a.screenshot({path:dir+'/frame-'+String(i).padStart(2,'0')+'.png'});await a.waitForTimeout(95);}
  }
  await Promise.all([a,b].map(p=>p.locator('#raceOver').waitFor({state:'visible',timeout:140000})));
  const reports=await Promise.all([a,b].map(p=>p.evaluate(()=>{
    const percentile=(values,q)=>values.sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*q))];
    return {results:net.room.results,impactTicks:sample.impact,frames:sample.frames.length,medianMs:percentile(sample.frames,.5),
      p95Ms:percentile(sample.frames,.95),correctionP95:percentile(sample.corrections,.95),maxPending:sample.history,maxLead:sample.maxLead,
      bytesPerSnap:sample.bytes/sample.snaps,snapshots:sample.snaps};
  })));
  assert.deepEqual(reports[0].results,reports[1].results);
  assert.ok(reports[0].results.every(c=>c.finished&&c.lap===3));
  assert.ok(reports[0].impactTicks.some(t=>reports[1].impactTicks.includes(t)));
  assert.ok(reports.every(r=>r.maxPending<=120 && r.maxLead<=12));assert.deepEqual(errors,[]);
  await writeFile(dir+'/driving.json',JSON.stringify({url,reports,errors},null,2));
  console.log(JSON.stringify(reports));
}finally{await browser.close();if(server)await server.close();}
