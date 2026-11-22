// Orthographic ground plane tilted toward the horizon. World geometry stays in meters of track space.
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
export function follow(camera, car, width, height, dt) {
  if (camera.heading === undefined || camera.followId !== car.id) {
    Object.assign(camera, { heading: car.angle, x: car.x, y: car.y, followId: car.id });
  }
  const bend = (car.rack || 0) * Math.min(car.speed / 500, 1) * .12;
  const difference = wrap(car.angle + bend - camera.heading);
  camera.heading += Math.sign(difference) * Math.min(Math.abs(difference) * (1 - Math.exp(-6 * dt)), 3.3 * dt);
  const blend = 1 - Math.exp(-18 * dt);
  camera.x += (car.x - camera.x) * blend;
  camera.y += (car.y - camera.y) * blend;
  camera.scale = Math.max(.65, Math.min(1.65, width / 490, height / 425));
  camera.depth = .77;
  camera.anchor = height * (.62 + .075 * Math.min(1, car.speed / 550));
  camera.rotation = -camera.heading - Math.PI / 2;
}
export function groundTransform(ctx, camera, width, height, shake) {
  ctx.translate(width / 2, height / 2);
  ctx.translate(shake, camera.anchor - height / 2);
  ctx.scale(camera.scale, camera.scale * camera.depth);
  ctx.rotate(camera.rotation);
  ctx.translate(-camera.x, -camera.y);
}
