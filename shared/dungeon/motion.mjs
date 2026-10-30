import {groundMotion,vlen,clamp} from './combat-data.mjs';
export function stepMotion(p,ci,input,dt,maximum,precision,angle,effects=[]){const aim=()=>angle;
  function applyGroundMovement(p, character, input, dt, maximum, precision) {
    const config = groundMotion[character];
    const speed = vlen(p.vx, p.vy);
    let surfaceMult = 1;
    for (let i = 0; i < effects.length; i++) {
      const e = effects[i];
      if (e.kind === 'frost' && e.t > 0 && vlen(p.x - e.x, p.y - e.y) < e.r) { surfaceMult = 0.42; break; }
    }
    if (!input.x && !input.y) {
      const remaining = Math.max(0, speed - config.brake * surfaceMult * dt);
      if (speed > 0.0001) { p.vx *= remaining / speed; p.vy *= remaining / speed; }
      else { p.vx = 0; p.vy = 0; }
      return;
    }
    const facing = aim();
    const align = input.x * Math.cos(facing) + input.y * Math.sin(facing);
    const stanceScale = align >= 0.25 ? 1 : (align <= -0.35 ? config.backMult : config.strafeMult);
    const goal = maximum * stanceScale * (precision ? config.pace : 1);
    const dx = input.x * goal - p.vx, dy = input.y * goal - p.vy, delta = vlen(dx, dy);
    if (delta < 0.0001) return;

    const dot = speed > 0.001 ? (p.vx * input.x + p.vy * input.y) / speed : 1;
    let force = dot < -0.25 ? config.reverse * (config.pivotBoost || 1) : dot < 0.72 ? config.turn : config.launch;
    if (speed > goal + 0.5 && dot > 0.72) force = config.brake;
    if (precision && speed > goal) force = Math.max(force, config.brake);

    const k = Math.min(1, (force * surfaceMult * dt) / delta);
    p.vx += dx * k; p.vy += dy * k;
  }
  function applyHoverMovement(p, input, dt, maximum, precision, firingFactor = 1) {
    const config = groundMotion[0];
    const speed = vlen(p.vx, p.vy);
    const damping = Math.exp(-(precision ? 4.2 : 2.55) * dt);
    p.vx *= damping; p.vy *= damping;
    if (!input.x && !input.y) {
      if (vlen(p.vx, p.vy) < 1.2) { p.vx = 0; p.vy = 0; }
      return;
    }
    const dot = speed > 0.001 ? (p.vx * input.x + p.vy * input.y) / speed : 1;
    const thrust = dot < -0.25 ? config.reverse : dot < 0.72 ? config.turn : config.launch;
    const power = thrust * (precision ? 0.56 : 1) * firingFactor;
    p.vx += input.x * power * dt; p.vy += input.y * power * dt;
    const cap = maximum * (precision ? config.pace : 1);
    const now = vlen(p.vx, p.vy);
    if (now > cap) {
      const prior = vlen(p.vx - input.x * power * dt, p.vy - input.y * power * dt);
      const next = prior <= cap + 1 ? cap : Math.max(cap, now - (precision ? 600 : 360) * dt);
      p.vx *= next / now; p.vy *= next / now;
    }
  }
if(ci===0)applyHoverMovement(p,input,dt,maximum,precision);else applyGroundMovement(p,ci,input,dt,maximum,precision);
}
