import test from 'node:test';
import assert from 'node:assert/strict';
import { Car } from '../js/car.js';
import { follow } from '../js/camera.js';
import { RacePlayout } from '../js/playout.js';

test('small taps steer immediately; a sustained hold builds progressively and releases promptly',()=>{
  for (const side of [-1,1]) {
    const c=new Car(0,1500,300);
    c.speed=c.vx=490;
    c.input.steer=side;
    for(let i=0;i<6;i++)c.update(1/60);
    assert.ok(c.angle*side>.01 && c.angle*side<.08);
    assert.ok(Math.abs(c.rack)<.45);
    const initialSpeed=c.speed;
    c.input.brake=1;
    for(let i=0;i<12;i++)c.update(1/60);
    assert.ok(c.speed<initialSpeed-100 && Math.abs(c.angle)<.55);
    c.input.steer=0;
    for(let i=0;i<8;i++)c.update(1/60);
    assert.equal(c.rack,0);
    const angle=c.angle;
    c.update(1/60); assert.equal(c.angle,angle);
  }
});
test('translation follows the same linear world path at 30/60/120 Hz',()=>{
  function run(fps){
    const c={id:0,x:0,y:0},camera={};
    follow(camera,c,844,390,0);
    for(let i=1;i<=fps;i++){
      c.x=i/fps*400;c.y=-i/fps*120;
      follow(camera,c,844,390,1/fps);
    }
    return camera;
  }
  const a=run(30);
  for(const fps of [60,120]){
    const b=run(fps);
    assert.ok(Math.abs(a.x-b.x)<.001 && Math.abs(a.y-b.y)<.001);
  }
});
const packet=(tick,received,x=tick*5)=>({tick,received,cars:[
  {participantId:'own',x,y:10,angle:0,vx:300,vy:0,rack:0,speed:300},
  {participantId:'other',x:x+70,y:0,angle:0,vx:300,vy:0,rack:0,speed:300}
]});
for(const fps of [30,60,120])test('positions stay monotonic through burst delivery at '+fps+' Hz',()=>{
  const p=new RacePlayout();
  let tick=0,previous=-1;
  for(let frame=0;frame<fps*4;frame++){
    const time=frame*1000/fps;
    while(tick*1000/60+(tick%18<6 ? 78 : 10)<=time){
      p.push(packet(tick,time));tick+=3;
    }
    const [a,b]=p.sample(time,'own',{steer:frame%2?1:-1});
    if(!a)continue;
    assert.ok(a.x>=previous && a.x-previous<65);
    assert.ok(Math.abs(b.x-a.x-70)<1e-8);
    previous=a.x;
  }
  assert.ok(previous>1000);
});
test('exceptional relocation never interpolates through missing geometry and a new race starts fresh',()=>{
  const p=new RacePlayout();p.push(packet(0,0));p.sample(0,'own');
  p.push(packet(3,50,2000));
  for(let i=1;i<=8;i++){
    const x=p.sample(i*16,'own')[0].x;
    assert.ok(x===0 || x===2000);
  }
  p.push(packet(90,1500,9000));
  assert.equal(p.sample(1500,'own')[0].x,9000);
  const fresh=new RacePlayout();fresh.push(packet(0,0));assert.equal(fresh.sample(0,'own')[0].x,0);
});
