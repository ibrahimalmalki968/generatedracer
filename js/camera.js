// Fixed oblique map projection. The linear-target filter has the same time
// constant at 30, 60 and 120 Hz and only sees the sampled presentation pose.
export function follow(camera, car, width, height, dt) {
  if (camera.lastX === undefined) {
    camera.filteredX = camera.lastX = car.x;
    camera.filteredY = camera.lastY = car.y;
  }
  if (dt > 0) {
    const tau = .055;
    const decay = Math.exp(-dt / tau);
    const lag = tau * (1 - decay) / dt;
    camera.filteredX = car.x + (camera.filteredX - camera.lastX) * decay - (car.x - camera.lastX) * lag;
    camera.filteredY = car.y + (camera.filteredY - camera.lastY) * decay - (car.y - camera.lastY) * lag;
    camera.lastX = car.x;
    camera.lastY = car.y;
  }
  // The playout pose is already continuous. Share its translation with the
  // kart; a small filtered component softens changes without visible recentering.
  camera.x = car.x + .10 * (camera.filteredX - car.x);
  camera.y = car.y + .10 * (camera.filteredY - car.y);
  camera.rotation = -.16;
  camera.depth = .78;
  camera.scale = Math.max(.60, Math.min(1.5, width / 540, height / 490));
  camera.anchor = height * .53;
}
export function groundTransform(ctx, camera, width, height) {
  ctx.translate(width / 2, height / 2);
  ctx.translate(0, camera.anchor - height / 2);
  ctx.scale(camera.scale, camera.scale * camera.depth);
  ctx.rotate(camera.rotation);
  ctx.translate(-camera.x, -camera.y);
}
