// Measure the actual world-to-screen Canvas transform at the instant the owned kart is drawn.
import { chromium } from 'playwright';
import { createGameServer } from '../server/server.js';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=process.env.EVIDENCE_DIR || 'work/motion';
await mkdir(dir,{recursive:true});
const server=process.env.BASE_URL ? null : await createGameServer();
const simulationIntervals=[];
if(server){
  const step=server.game.step.bind(server.game);
  let previous=null;
  server.game.step=()=>{
    const now=performance.now();
    if(previous!==null && server.game.rooms.size)simulationIntervals.push(now-previous);
    previous=now;
    return step();
  };
}
const url=process.env.BASE_URL || 'http://127.0.0.1:'+server.port;
const fps=Number(process.env.FRAME_RATE || 60);
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome'});
const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,
  ...(process.env.VIDEO ? {recordVideo:{dir,size:{width:844,height:390}}} : {})});
try {
  const p=await ctx.newPage(), errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(cap=>{
    const raf=window.requestAnimationFrame.bind(window);
    // Schedule the game on real animation frames, at half cadence for the 30 Hz run.
    if(cap===30) window.requestAnimationFrame=fn=>raf(()=>raf(fn));
  },fps);
  await p.goto(url);
  await p.evaluate(async()=>{
    const {Network}=await import('/js/network.js'), {Car}=await import('/js/car.js'), {AiController}=await import('/js/ai.js');
    const {apply,predict,send}=Network.prototype, draw=Car.prototype.draw;
    const s=window.trace={frames:[],packets:[]}, sends=new Map();
    let net,bot,lastIn=0,lastOut=0;
    Network.prototype.send=function(m){
      if(m.type!=='input')return send.call(this,m);
      const now=performance.now();sends.set(m.seq,now);
      lastOut=Math.max(lastOut+.1,now+58+31*Math.sin(m.seq*.09));
      setTimeout(()=>send.call(this,m),lastOut-now);
      return true;
    };
    Network.prototype.apply=function(snap){
      const now=performance.now();
      // Ordered WSS delivery with a periodic queue on top of asymmetric jitter.
      lastIn=Math.max(lastIn+.1,now+40+22*Math.sin(snap.tick*.13)+(snap.tick%90<10 ? 90 : 0));
      setTimeout(()=>{
        const pre=this.predicted && {x:this.predicted.x,y:this.predicted.y};
        apply.call(this,snap);net=this;
        const c=snap.cars.find(c=>c.participantId===this.playerId);
        if(!c || !this.predicted)return;
        const ackMs=performance.now()-sends.get(c.ack);
        s.packets.push({time:performance.now(),server:snap.serverNow,tick:snap.tick,x:c.x,y:c.y,vx:c.vx,vy:c.vy,
          ackMs:Number.isFinite(ackMs)?ackMs:null,impactTick:c.impactTick,
          reset:pre?Math.hypot(this.predicted.x-pre.x,this.predicted.y-pre.y):0});
        for(const seq of sends.keys())if(seq<=c.ack)sends.delete(seq);
      },lastIn-now);
    };
    Network.prototype.predict=function(input){
      const c=this.predicted;
      if(c && !c.finished){
        bot ||= new AiController(new Car(c.id,c.x,c.y,c.angle,{isHuman:false}),.55);
        Object.assign(bot.car,c,{isHuman:false});
        bot.update(1/60,this.latest.cars.filter(r=>r.id!==c.id));input=bot.car.input;
      }
      return predict.call(this,input);
    };
    Car.prototype.draw=function(context,...args){
      if(net && this.participantId===net.playerId){
        const m=context.getTransform(), k=context.canvas.width/context.canvas.clientWidth;
        const x=this.x,y=this.y, sx=(m.a*x+m.c*y+m.e)/k, sy=(m.b*x+m.d*y+m.f)/k;
        const center=new DOMPoint(context.canvas.width/2,context.canvas.height/2).matrixTransform(m.inverse());
        s.frames.push({time:performance.now(),x,y,sx,sy,cx:center.x,cy:center.y,
          rotation:Math.atan2(-m.c,m.a),angle:this.angle,tick:net.latest.tick,impactTick:this.impactTick,
          ax:net.latest.cars[this.id].x,ay:net.latest.cars[this.id].y,speed:this.speed,px:net.predicted.x,py:net.predicted.y});
      }
      return draw.call(this,context,...args);
    };
  });
  await p.locator('#nickname').fill('Motion');await p.locator('#nicknameForm button').tap();await p.locator('#btn-solo').tap();
  await p.waitForFunction(()=>trace.frames.length>12 && trace.frames.at(-1).tick>960,null,{timeout:55000});
  const trace=await p.evaluate(()=>window.trace);
  await writeFile(dir+'/trajectory.json',JSON.stringify(trace));
  const q=(a,n)=>a.filter(Number.isFinite).sort((x,y)=>x-y)[Math.floor(a.filter(Number.isFinite).length*n)];
  const dt=[], turns=[],reverse=[],jolt=[],cam=[],screen=[],ticks=[],arrivals=[],authority=[];
  for(let i=1;i<trace.packets.length;i++){
    const a=trace.packets[i-1],b=trace.packets[i];if(b.tick<=a.tick)continue;
    ticks.push((b.server-a.server)/(b.tick-a.tick));arrivals.push(b.time-a.time);
    if(b.tick-b.impactTick>18)authority.push(((b.x-a.x)*a.vx+(b.y-a.y)*a.vy)/Math.max(1,Math.hypot(a.vx,a.vy)));
  }
  for(let i=1;i<trace.frames.length;i++){
    const a=trace.frames[i-1],b=trace.frames[i],ms=b.time-a.time;if(ms<3)continue;
    dt.push(ms);const rot=b.rotation-a.rotation;
    turns.push(Math.abs(Math.atan2(Math.sin(rot),Math.cos(rot)))*180/Math.PI*1000/ms);
    cam.push(Math.hypot(b.cx-a.cx,b.cy-a.cy));screen.push(Math.hypot(b.sx-a.sx,b.sy-a.sy));
    if(b.tick-b.impactTick>18 && b.speed>80){
      const forward=(b.x-a.x)*Math.cos(a.angle)+(b.y-a.y)*Math.sin(a.angle);
      reverse.push(forward);
      if(i>1){const c=trace.frames[i-2];jolt.push(Math.hypot((b.sx-a.sx)-(a.sx-c.sx),(b.sy-a.sy)-(a.sy-c.sy)));}
    }
  }
  const result={fps,frames:dt.length,packets:trace.packets.length,frameMsP50:q(dt,.5),frameMsP95:q(dt,.95),
    serverMsPerTickP50:q(ticks,.5),arrivalMsP95:q(arrivals,.95),localSchedulerIntervalMsP50:q(simulationIntervals,.5),localSchedulerIntervalMsP95:q(simulationIntervals,.95),ackMsP95:q(trace.packets.map(p=>p.ackMs).filter(Number.isFinite),.95),
    predictionResetP95:q(trace.packets.map(p=>p.reset),.95),rotationDegPerSecP95:q(turns,.95),
    cleanFrames:reverse.length,reverseFrames:reverse.filter(n=>n<-.75).length,worstForward:Math.min(...reverse),
    authorityReverse:authority.filter(n=>n<-.75).length,screenJoltPxP95:q(jolt,.95),screenDeltaP95:q(screen,.95),cameraDeltaP95:q(cam,.95),errors};
  console.log(JSON.stringify(result));await writeFile(dir+'/summary.json',JSON.stringify(result,null,2));
  assert.deepEqual(errors,[]);
  if(process.env.CHECK_COMFORT){assert.equal(result.rotationDegPerSecP95,0);assert.equal(result.reverseFrames,0);assert.ok(result.screenJoltPxP95<1.5,'screen-space jitter budget');}
}finally{await ctx.close();await browser.close();await server?.close();}
