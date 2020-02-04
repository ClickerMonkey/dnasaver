import { Application, Sprite, Texture, ParticleContainer, BLEND_MODES, UPDATE_PRIORITY, Graphics, Container } from 'pixi.js';

const app = new Application({
  backgroundColor: 0x000000,
  antialias: true,
});
document.body.appendChild(app.view);

app.ticker.maxFPS = 30;


const BOUNCE_BUFFER = 20;
const SPEED = 200;
const SPACING = 2;
const SCALE = 0.15;
// const SCALE_END = 0.1;
const SPREAD = 30;
const SPREAD_MODIFIER = 8;
// const SCALE_WANDERER = wanderer(0, 1, 0.1, 0.3, 5, 20);
const COLOR_WANDERER = wanderer(0, 360, 10, 100, 5, 20);
const PARTICLES_PER_LINE = 6;
const LINE_WIDTH = 2;
const LINE_COLOR = 0xffffff;
const LINE_ALPHA = 0.3;

const sphereTexture = Texture.from('sphere.png');

// Listen for window resize events
window.addEventListener('resize', resize);

// Resize function window
function resize() {
	// Resize the renderer
	app.renderer.resize(window.innerWidth, window.innerHeight);
}

resize();

const sprites = new ParticleContainer(10000, {
  position: true,
  uvs: true,
  tint: true,
});
sprites.blendMode = BLEND_MODES.ADD;
app.stage.addChild(sprites);

const lines = new Container();
app.stage.addChild(lines);

interface Particle {
  life: number;
  time: number;
  sprite: Sprite;
  line: Graphics;
}

interface Point {
  x: number;
  y: number;
}

const particles: Particle[] = [];
const particlesFree: Particle[] = [];

let pos: Point = {
  x: rndf(0, window.innerWidth),
  y: rndf(0, window.innerHeight),
};
let lastSpawn: Point = { ...pos };
let angle = (rndi(0, 3) * 90 + 45 - rndf(-15, 15)) / 180 * Math.PI;
let vel: Point = {
  x: Math.cos(angle) * SPEED,
  y: Math.sin(angle) * SPEED,
};

let time = 0;
let lineCounter = 0;

app.ticker.add(() => 
{
  app.renderer.render(app.stage);
  const delta = app.ticker.deltaMS * 0.001;

  pos.x += vel.x * delta;
  pos.y += vel.y * delta;

  let hit = false;

  if (pos.x < -BOUNCE_BUFFER) {
    pos.x = -BOUNCE_BUFFER;
    vel.x = Math.abs(vel.x);
    hit = true;
  }
  if (pos.x >= app.screen.width + BOUNCE_BUFFER) {
    pos.x = app.screen.width + BOUNCE_BUFFER;
    vel.x = -Math.abs(vel.x);
    hit = true;
  }
  if (pos.y < -BOUNCE_BUFFER) {
    pos.y = -BOUNCE_BUFFER;
    vel.y = Math.abs(vel.y);
    hit = true;
  }
  if (pos.y >= app.screen.height + BOUNCE_BUFFER) {
    pos.y = app.screen.height + BOUNCE_BUFFER;
    vel.y = -Math.abs(vel.y);
    hit = true;
  }

  if (hit) {
    // vel.y *= rndf(0.5, 1.5);
    // vel.x *= rndf(0.5, 1.5);

    const lsq = lengthSq(vel);

    if (lsq > SPEED * SPEED) {
      const scale = SPEED / Math.sqrt(lsq);
      vel.x *= scale;
      vel.y *= scale;
    }
  }

  let alive = 0;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.time += delta;
    if (p.time > p.life) {
      sprites.removeChild(p.sprite);
      lines.removeChild(p.line);
      freeParticle(p);
    } else {
      const d = p.time / p.life;

      p.sprite.alpha = 1 - d;
      p.line.alpha = 1 - d;
      particles[alive++] = p;
    }
  }

  particles.splice(alive, particles.length - alive);

  const dx = pos.x - lastSpawn.x;
  const dy = pos.y - lastSpawn.y;
  let distance = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / distance;
  const ny = dy / distance;

  const wanderingScale = 1; // SCALE_WANDERER(delta) * 1 + 0.5;
  const spacing = SPACING * wanderingScale;

  const wanderingColor = COLOR_WANDERER(delta);

  while (distance >= spacing)
  {
    time += 0.01;

    lastSpawn.x += nx * spacing;
    lastSpawn.y += ny * spacing;

    const spread = Math.sin(time * SPREAD_MODIFIER) * SPREAD * wanderingScale;

    lineCounter++;
    const addLine = lineCounter >= PARTICLES_PER_LINE;
    if (addLine) {
      lineCounter -= PARTICLES_PER_LINE;
    }

    const p0 = getParticle();
    p0.time = 0;
    p0.life = 10;
    const s0 = p0.sprite;
    s0.scale.set(SCALE * wanderingScale * 1.1);
    s0.x = lastSpawn.x + ny * spread;
    s0.y = lastSpawn.y - nx * spread;
    s0.tint = HSLToRGB(wanderingColor, 100, 50);
    if (addLine) {
      const l0 = p0.line;
      l0.clear();
      l0.lineStyle(LINE_WIDTH, LINE_COLOR, LINE_ALPHA);
      l0.moveTo(lastSpawn.x, lastSpawn.y);
      l0.lineTo(s0.x, s0.y);
      l0.closePath();
      lines.addChild(l0);
    }
    sprites.addChild(s0);
    particles.push(p0);

    const p1 = getParticle();
    p1.time = 0;
    p1.life = 10;
    const s1 = p1.sprite;
    s1.scale.set(SCALE * wanderingScale);
    s1.x = lastSpawn.x - ny * spread;
    s1.y = lastSpawn.y + nx * spread;
    s1.tint = HSLToRGB(wanderingColor, 100, 10);
    if (addLine) {
      const l1 = p1.line;
      l1.clear();
      l1.lineStyle(LINE_WIDTH, LINE_COLOR, LINE_ALPHA);
      l1.moveTo(lastSpawn.x, lastSpawn.y);
      l1.lineTo(s1.x, s1.y);
      l1.closePath();
      lines.addChild(l1);
    }
    sprites.addChild(s1);
    particles.push(p1);

    distance -= spacing;
  }
  
}, UPDATE_PRIORITY.LOW);

app.ticker.start();

function getParticle(): Particle {
  if (particlesFree.length > 0) {
    return particlesFree.pop();
  }

  const sprite = Sprite.from(sphereTexture);
  sprite.anchor.set(0.5);
  sprite.tint = 0xffffff;

  const line = new Graphics();
  
  return {
    time: 0,
    life: 0,
    sprite,
    line,
  };
}

function freeParticle(p: Particle) {
  particlesFree.push(p);
}

function rndi(min: number, max: number): number {
  return Math.floor((max - min + 1) * Math.random()) + min;
}

function rndf(min: number, max: number): number {
  return (max - min) * Math.random() + min;
}

function lengthSq(a: Point) {
  return a.x * a.x + a.y * a.y;
}

function wanderer(min: number, max: number, minVel: number, maxVel: number, minTime: number, maxTime: number) {
  let value = rndf(min, max);
  let vel = rndf(minVel, maxVel) * (rndi(0, 1) * 2 - 1);
  let time = rndf(minTime, maxTime);

  return (delta: number): number => {
    time -= delta;
    value += vel * delta;

    if (value < min) {
      value = min;
      vel = -vel;
    }  else if (value > max) {
      value = max;
      vel = -vel;
    }

    if (time < 0) {
      time = rndf(minTime, maxTime);
      vel = -Math.sign(vel) * rndf(minVel, maxVel);
    }

    return value;
  };
}

function HSLToRGB(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;

  let c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs((h / 60) % 2 - 1)),
      m = l - c/2,
      r = 0,
      g = 0,
      b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return (r << 16) | (g << 8) | (b);
}

(window as any).particles = particles;