let canvas,
  DIM,
  ctx,
  frameCount = 0,
  mouseX,
  mouseY,
  camera,
  lastTime,
  player;
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  q: false,
  e: false,
  space: false,
};
let perlin = {
  rand_vect: function () {
    let theta = Math.random() * 2 * Math.PI;
    return { x: Math.cos(theta), y: Math.sin(theta) };
  },
  dot_prod_grid: function (x, y, vx, vy) {
    let g_vect;
    let d_vect = { x: x - vx, y: y - vy };
    if (this.gradients[[vx, vy]]) {
      g_vect = this.gradients[[vx, vy]];
    } else {
      g_vect = this.rand_vect();
      this.gradients[[vx, vy]] = g_vect;
    }
    return d_vect.x * g_vect.x + d_vect.y * g_vect.y;
  },
  smootherstep: function (x) {
    return 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
  },
  interp: function (x, a, b) {
    return a + this.smootherstep(x) * (b - a);
  },
  seed: function () {
    this.gradients = {};
    this.memory = {};
  },
  get: function (x, y) {
    if (this.memory.hasOwnProperty([x, y])) return this.memory[[x, y]];
    let xf = Math.floor(x);
    let yf = Math.floor(y);
    //interpolate
    let tl = this.dot_prod_grid(x, y, xf, yf);
    let tr = this.dot_prod_grid(x, y, xf + 1, yf);
    let bl = this.dot_prod_grid(x, y, xf, yf + 1);
    let br = this.dot_prod_grid(x, y, xf + 1, yf + 1);
    let xt = this.interp(x - xf, tl, tr);
    let xb = this.interp(x - xf, bl, br);
    let v = this.interp(y - yf, xt, xb);
    this.memory[[x, y]] = v;
    return v;
  },
};
perlin.seed();

class Vector {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  get magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  get magSqrd() {
    return this.x * this.x + this.y * this.y;
  }
  add(other) {
    return new Vector(this.x + other.x, this.y + other.y);
  }
  subtract(other) {
    return new Vector(this.x - other.x, this.y - other.y);
  }
  scale(n) {
    return new Vector(this.x * n, this.y * n);
  }
  invScale(n) {
    return new Vector(this.x / n, this.y / n);
  }
  scaleVec(other) {
    return new Vector(this.x * other.x, this.y * other.y);
  }
  invScaleVec(other) {
    return new Vector(this.x / other.x, this.y / other.y);
  }
  dot(other) {
    return this.x * other.x + this.y * other.y;
  }
  normalized() {
    return this.invScale(this.magnitude);
  }
}
class Camera {
  tiling = 50;
  constructor(cx, cy, cw, ch) {
    this.pos = new Vector(cx, cy);
    this.size = new Vector(cw, ch);
  }
  get ratio() {
    return this.size.y / this.size.x;
  }
  toScreen(position) {
    return position
      .subtract(this.pos)
      .invScaleVec(this.size)
      .scaleVec(DIM)
      .add(DIM.scale(0.5));
  }
  sizeToScreen(n) {
    return (n / this.size.x) * DIM.x;
  }
  setZoom(n) {
    if (n < 0.1) n = 0.1;
    if (n > 4) n = 4;
    this.size = DIM.invScale(n);
  }
  addZoom(n) {
    const current = DIM.x / this.size.x;
    this.setZoom(current + n);
  }
  drawTiles() {
    ctx.beginPath();
    ctx.lineWidth = this.sizeToScreen(1);

    const s = this.sizeToScreen(this.tiling);
    for (
      let x =
        ((-(this.pos.x - this.size.x / 2) % this.tiling) + this.tiling) %
        this.tiling;
      x <= this.size.x;
      x += this.tiling
    ) {
      const px = (x / this.size.x) * DIM.x;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, DIM.y);
    }
    for (
      let y =
        ((-(this.pos.y - this.size.y / 2) % this.tiling) + this.tiling) %
        this.tiling;
      y <= this.size.y;
      y += this.tiling
    ) {
      const py = (y / this.size.y) * DIM.y;
      ctx.moveTo(0, py);
      ctx.lineTo(DIM.x, py);
    }

    ctx.strokeStyle = "lightGray";
    ctx.stroke();
  }
  lerpTo(x, y, speed) {
    this.pos.x += (x - this.pos.x) * speed;
    this.pos.y += (y - this.pos.y) * speed;
  }
}
class Player {
  constructor() {
    this.pos = new Vector(0, -200);
    this.vel = new Vector(10, -5);
    this.r = 10;
    this.gravity = 0.05;
    this.gravityMultiplyer = 6;
    this.currentHeight = 0;
    this.grounded = false;
  }
  update() {
    this.pos = this.pos.add(this.vel);
    if (keys.space) this.vel.y += this.gravity * this.gravityMultiplyer;
    else this.vel.y += this.gravity;

    const x1 =
      this.pos.x -
      (((this.pos.x % camera.tiling) + camera.tiling) % camera.tiling);
    const x2 = x1 + camera.tiling;
    const y1 = getGround(x1);
    const y2 = getGround(x2);
    this.currentHeight =
      y1 +
      ((y2 - y1) / camera.tiling) * (this.pos.x - x1) -
      (this.pos.y - this.r);
    this.currentHeight = Math.min(y1, y2) - this.pos.y;
    if (this.currentHeight < this.r * 2.1) {
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    this.collidePlatform(new Vector(x1, y1), new Vector(x2, y2));
    if (this.grounded && this.vel.x < 1) {
      this.vel.x = 1;
    }
  }
  draw() {
    const circlePos = camera.toScreen(new Vector(this.pos.x, this.pos.y));
    ctx.beginPath();
    ctx.arc(
      circlePos.x,
      circlePos.y,
      camera.sizeToScreen(this.r * 2),
      0,
      2 * Math.PI
    );
    ctx.strokeStyle = "black";
    ctx.lineWidth = camera.sizeToScreen(2);
    ctx.stroke();

    if (keys.space) {
      ctx.beginPath();
      ctx.arc(
        circlePos.x,
        circlePos.y,
        camera.sizeToScreen(this.r * 1),
        0,
        2 * Math.PI
      );
      ctx.stroke();
    }
  }
  collidePlatform(p1, p2) {
    // Get projection point
    const vector = p2.subtract(p1);
    const tangent = vector.normalized();
    const p1ToPlayer = this.pos.subtract(p1);
    let tProjection = p1ToPlayer.dot(tangent);
    if (tProjection < 0) tProjection = 0;
    else if (tProjection > vector.magnitude) tProjection = vector.magnitude;
    const point = p1.add(tangent.scale(tProjection));
    // get projection distance
    let pointToPlayer = this.pos.subtract(point);
    let depth = 0 + this.r * 2 - pointToPlayer.magnitude;
    if (depth > 0) {
      pointToPlayer = pointToPlayer.normalized();
      if (pointToPlayer.y < 0) {
        depth += 0.1;
      }
      // position
      this.pos = this.pos.add(pointToPlayer.scale(depth));
      // velocity
      const vProjection = pointToPlayer.dot(this.vel) * -1;
      this.vel = this.vel.add(pointToPlayer.scale(vProjection));
    }
  }
}

function getGround(x) {
  const output = perlin.get(x * 0.002, 0) * 300 + x * 0.01;
  // const output = Math.sin(x * 0.003) * 100 + x * 0.1;
  return output;
}
function setup() {
  canvas = document.getElementById("gameCanvas");
  canvas.width =
    window.innerWidth ||
    document.documentElement.clientWidth ||
    document.body.clientWidth;
  canvas.height =
    window.innerHeight ||
    document.documentElement.clientHeight ||
    document.body.clientHeight;
  DIM = new Vector(canvas.width, canvas.height);
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("keydown", onMouseDown, false);
  window.addEventListener("keyup", onMouseUp, false);
  canvas.addEventListener("mousemove", function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  ctx = canvas.getContext("2d");
  camera = new Camera(0, 0, DIM.x, DIM.y);
  player = new Player();
  lastTime = new Date().getTime();

  draw();
}
function userInput() {
  const speed = 3;
  if (keys.up) camera.pos.y -= speed;
  if (keys.down) camera.pos.y += speed;
  if (keys.right) camera.pos.x += speed;
  if (keys.left) camera.pos.x -= speed;
  if (keys.e) camera.addZoom(0.03);
  if (keys.q) camera.addZoom(-0.03);
}
let camZoom = 1;
function draw() {
  const currentTime = new Date().getTime();
  const delta = currentTime - lastTime;
  lastTime = currentTime;
  if (frameCount % 60 == 0) {
    //console.log(1000 / delta);
  }

  userInput();

  ctx.clearRect(0, 0, DIM.x, DIM.y);
  camera.lerpTo(player.pos.x + player.vel.x * 40, player.pos.y, 0.05);

  if (player.vel.magnitude < 10) {
    camZoom += (1 - camZoom) * 0.03;
  } else {
    camZoom +=
      (1 - Math.sqrt((player.vel.magnitude - 10) * 0.015) - camZoom) * 0.03;
  }
  camera.setZoom(camZoom);
  camera.drawTiles();

  drawGround();
  player.update();
  player.draw();

  frameCount++;
  requestAnimationFrame(draw);
}
function drawGround() {
  ctx.beginPath();
  let lastPos = camera.toScreen(
    new Vector(
      camera.pos.x - camera.size.x / 2,
      getGround(camera.pos.x - camera.size.x / 2)
    )
  );
  for (
    let x =
      camera.pos.x -
      camera.size.x / 2 -
      ((camera.pos.x - camera.size.x / 2) % camera.tiling) -
      camera.tiling;
    x <= camera.pos.x + camera.size.x / 2 + camera.tiling;
    x += camera.tiling
  ) {
    const y = getGround(x);
    const pos = camera.toScreen(new Vector(x, y));
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    lastPos = pos;
  }
  ctx.lineWidth = camera.sizeToScreen(2);
  ctx.strokeStyle = "black";

  ctx.stroke();
}

function resizeCanvas() {
  canvas.width =
    window.innerWidth ||
    document.documentElement.clientWidth ||
    document.body.clientWidth;
  canvas.height =
    window.innerHeight ||
    document.documentElement.clientHeight ||
    document.body.clientHeight;

  DIM.x = canvas.width;
  DIM.y = canvas.height;
  camera.size.x = DIM.x;
  camera.size.y = DIM.y;
}
function onMouseDown(event) {
  if (event.defaultPrevented) return;
  switch (event.code) {
    case "KeyS":
    case "ArrowDown":
      keys.down = true;
      break;
    case "KeyW":
    case "ArrowUp":
      keys.up = true;
      break;
    case "KeyA":
    case "ArrowLeft":
      keys.left = true;
      break;
    case "KeyD":
    case "ArrowRight":
      keys.right = true;
      break;
    case "KeyE":
      keys.e = true;
      break;
    case "KeyQ":
      keys.q = true;
      break;
    case "Space":
      keys.space = true;
      break;
  }
}
function onMouseUp(event) {
  if (event.defaultPrevented) return;
  switch (event.code) {
    case "KeyS":
    case "ArrowDown":
      keys.down = false;
      break;
    case "KeyW":
    case "ArrowUp":
      keys.up = false;
      break;
    case "KeyA":
    case "ArrowLeft":
      keys.left = false;
      break;
    case "KeyD":
    case "ArrowRight":
      keys.right = false;
      break;
    case "KeyE":
      keys.e = false;
      break;
    case "KeyQ":
      keys.q = false;
      break;
    case "Space":
      keys.space = false;
      break;
  }
}

setup();
draw();
