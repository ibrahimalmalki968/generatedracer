import test from 'node:test';
import assert from 'node:assert/strict';
import { Car, resolveCarCollision } from '../js/car.js';
import { MAX_SPEED, SIMULATION_STEP as dt, TRACK_WIDTH } from '../js/constants.js';
import { LocalSession } from '../js/simulation.js';
import { roadFrame } from '../js/track.js';
import { AiController } from '../js/ai.js';
import { Network } from '../js/network.js';
import { follow } from '../js/camera.js';

function kart(x=1500,y=300,a=0,id=0) { return new Car(id,x,y,a); }
function roll(c,n) { for (let i=0;i<n;i++) c.update(dt); }
function moving(c,speed) {
  c.speed=speed; c.vx=Math.cos(c.angle)*speed; c.vy=Math.sin(c.angle)*speed;
  return c;
}

test('automatic drive, progressive response, braking to rest and release', () => {
  const c=kart(); roll(c,30); const first=c.speed; roll(c,30);
  assert.ok(first > 150 && c.speed > first && c.speed-first < first);
  c.input.brake=1; roll(c,60); assert.equal(c.speed,0);
  const x=c.x; roll(c,30); assert.equal(c.x,x);
  c.input.brake=0; roll(c,6); assert.ok(c.speed>0 && c.speed<60);
});
test('steering builds smoothly, fast turns are wider and slip settles', () => {
  const slow=moving(kart(),160), fast=moving(kart(),500);
  for (const c of [slow,fast]) { c.input.steer=1; roll(c,1); assert.ok(c.rack>0 && c.rack<.4); roll(c,9); }
  assert.ok(fast.angle<slow.angle && fast.angle>0);
  const slip=fast.angle-Math.atan2(fast.vy,fast.vx); assert.ok(slip>.03 && slip<.37);
  fast.input.steer=0; roll(fast,18);
  assert.ok(Math.abs(fast.angle-Math.atan2(fast.vy,fast.vx))<slip);
});
test('fixed ticks give identical poses at 30, 60 and 120 render updates per second', () => {
  function run(fps) {
    const s=new LocalSession(2); s.start(); let remainder=0;
    for(let frame=0;frame<fps*4;frame++){
      remainder+=120/fps;
      while(remainder>=2){ s.step(dt,[{steer:.28,brake:0,turbo:false}]); remainder-=2; }
    }
    return s.cars.map(c=>[c.x,c.y,c.angle,c.speed,c.lap]);
  }
  assert.deepEqual(run(30),run(120)); assert.deepEqual(run(60),run(120));
});
for (const [label,dx,dy,angle] of [['rear',48,0,0],['side',0,25,.3],['angled',31,17,-.6],['coincident',0,0,0]]) {
  test(label+' contact separates and cannot add kinetic energy',()=>{
    const a=moving(kart(),640), b=moving(kart(1500+dx,300+dy,angle,1),230);
    if(label==='side'){a.vy=100; a.vx=400;}
    const energy=()=>a.vx**2+a.vy**2+b.vx**2+b.vy**2;
    const before=energy();assert.ok(resolveCarCollision(a,b));assert.ok(energy()<=before+.001);
    assert.ok(!resolveCarCollision(a,b));
    if(label==='rear') assert.ok(a.speed<640 && b.speed>230 && a.impact>0);
  });
}
test('six-car compression remains finite and contained, including Turbo wall strikes',()=>{
  const s=new LocalSession(6); s.start();
  for(const c of s.cars) { c.x=1650+c.id*12;c.y=375+c.id*2;c.angle=Math.PI*.40;moving(c,520); }
  const inputs=s.cars.map(()=>({steer:0,brake:0,turbo:true}));
  for(let i=0;i<180;i++) {
    s.step(dt,inputs);
    for(const c of s.cars) assert.ok(Math.abs(roadFrame(c.x,c.y).offset)<TRACK_WIDTH/2);
  }
  assert.ok(s.cars.every(c=>Number.isFinite(c.angle) && c.turboUses===1 && c.speed>0));
  assert.ok(s.cars.some(c=>c.impact>0));
});
test('a head-on strike sheds normal velocity and recovers with steering',()=>{
  const c=moving(kart(1510,390,Math.PI/2),680); c.input.turbo=true;
  roll(c,6);assert.ok(c.impact>0 && c.speed<260);
  c.input.steer=-1;roll(c,28);c.input.steer=0;const x=c.x;roll(c,100);
  assert.ok(Math.abs(c.x-x)>80 && c.speed>130);
});
test('bots anticipate corners, change lanes around traffic and physically finish after disturbance',()=>{
  const s=new LocalSession(1);s.start();const ai=s.ai[0], c=ai.car;
  const rival=s.cars[0];rival.x=c.x+75;rival.y=c.y;
  ai.update(dt,s.cars);assert.notEqual(ai.passSide,0);
  const lanes=new Set(), speeds=[], boosts=new Set();
  for(let tick=0;tick<9000 && !s.cars.slice(1).every(c=>c.finished);tick++){
    if(tick===240){c.angle+=.85;c.vx*=.6;c.vy*=.6;}
    s.step(dt,[{steer:0,brake:1,turbo:false}]);
    if(tick%20===0){lanes.add(Math.round(roadFrame(c.x,c.y).offset/12));speeds.push(c.input.brake);}
    for(const bot of s.cars.slice(1))if(bot.turboUses)boosts.add(bot.id);
  }
  assert.ok(lanes.size>=4 && speeds.some(b=>b>.2));assert.equal(boosts.size,5);
  assert.ok(s.cars.slice(1).every(c=>c.finished && c.lap===3 && c.turboUses<=3));
});
test('camera follows through the heading seam with forward framing and finite rotation',()=>{
  const c=moving(kart(),MAX_SPEED); c.angle=Math.PI-.01;
  const camera={}; follow(camera,c,844,390,dt);const heading=camera.heading;
  c.angle=-Math.PI+.05;follow(camera,c,844,390,dt);
  assert.ok(camera.heading>=heading && camera.heading-heading<.055);
  assert.ok(camera.anchor>390*.65 && camera.depth<1 && camera.scale*52>36);
});

test('a long acknowledgement gap bounds the visual lead while continuing to send current controls',()=>{
  const net = new Network(); net.playerId='p'; net.ready=true;
  net.room={code:'AB',raceId:'one',phase:'racing'};
  const car=moving(kart(),310);
  const snapshot={roomCode:'AB',raceId:'one',tick:300,cars:[{...car,participantId:'p',ack:0}]};
  net.apply(snapshot);
  let sent=0;
  net.send=()=>{sent++; return true;};
  for(let i=0;i<175;i++)net.predict({steer:i%2 ? 1 : 0,brake:0,turbo:false,gas:1});
  assert.equal(sent,175); assert.equal(net.pending.length,120);
  assert.equal(net.predicted.tick-snapshot.tick,12);
  net.apply({...snapshot,tick:340,cars:[{...snapshot.cars[0],ack:100}]});
  assert.equal(net.pending.length,75); assert.equal(net.predicted.tick-340,8);
});

test('a faster bot clears a slower car on the start straight through a clean lane',()=>{
  for (const approachSpeed of [300,370,430]) {
    const passer=moving(new Car(1,1390,304,0,{isHuman:false}),approachSpeed);
    const leader=moving(kart(1550,304),210);
    const driver=new AiController(passer,.6);
    const field=[passer,leader];
    for(let i=0;i<150 && passer.x<leader.x+52;i++){
      leader.input.brake = leader.speed>235 ? .55 : 0;
      driver.update(dt,field);
      for(const c of field) c.update(dt);
      assert.ok(!resolveCarCollision(passer,leader));
    }
    assert.ok(passer.x>=leader.x+52);
  }
});
