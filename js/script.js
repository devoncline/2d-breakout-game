const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ctx.fillStyle = '#eeeeee';
// ctx.fillRect(0, 0, canvas.width, canvas.height);

// ctx.beginPath();
// ctx.arc(240, 160, 10, 0, Math.PI * 2);
// ctx.fillStyle = 'red';
// ctx.fill();
// ctx.closePath();

class GameObject {
    asset;
    ctx;
    size = { w: undefined, h: undefined };
    pos = { x: 0, y: 0 };
    origin = { x: 0.5, y: 0.5 };

    constructor(url, ctx) {
        this.asset = new Image();
        this.asset.src = url;
        this.ctx = ctx;
    }

    async preload() {
        await this.asset.decode();

        if (this.size.w === undefined) {
            this.size.w = this.asset.width;
            this.size.h = this.asset.height;
        }
    }

    get hitbox() {
        const left = this.pos.x - this.size.w * this.origin.x;
        const top = this.pos.y - this.size.h * this.origin.y;
        return {
            left,
            right: left + this.size.w,
            top,
            bottom: top + this.size.h,
        };
    }
    draw() {
        const { left, top } = this.hitbox;
        this.ctx.drawImage(this.asset, left, top);
    }
    onCollide() { }
}

class Ball extends GameObject {
    pos = { x: 50, y: 50 };
    vel = { x: 150, y: 150 };

    move(dt) {
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
    }

    onCollide({ x, y }) {
        if (x) {
            this.vel.x = -this.vel.x;
        }

        if (y) {
            this.vel.y = -this.vel.y;
        }
    }
}

class Paddle extends GameObject {
    origin = { x: 0.5, y: 1 };

    constructor(url, ctx) {
        super(url, ctx);
        this.pos = { x: ctx.canvas.width / 2, y: ctx.canvas.height - 5 };
    }
}

const ball = new Ball("img/ball.png", ctx);
const paddle = new Paddle("img/paddle.png", ctx);

const baseWallHitbox = {
  left: -Infinity,
  right: Infinity,
  top: -Infinity,
  bottom: Infinity,
};

const colliders = [
  { hitbox: { ...baseWallHitbox, right: 0 } },
  { hitbox: { ...baseWallHitbox, left: canvas.width } },
  { hitbox: { ...baseWallHitbox, bottom: 0 } },
  { hitbox: { ...baseWallHitbox, top: canvas.height } },
];

colliders.push(paddle);

Promise.all([ball, paddle].map((obj) => obj.preload())).then(() =>
    requestAnimationFrame(update),
);

let lastTimestamp = null;
function update(timestamp) {
    const dt = lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    moveBall(dt);

    ctx.fillStyle = "#eeeeee";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ball.draw();
    paddle.draw();

    requestAnimationFrame(update);
}

function getCollision(moving, velocity, obstacle, dt) {
  const width = moving.right - moving.left;
  const height = moving.bottom - moving.top;
  const movingPos = { x: moving.left, y: moving.top };
  const left = obstacle.left - width;
  const right = obstacle.right;
  const top = obstacle.top - height;
  const bottom = obstacle.bottom;
  const hit = { time: dt, x: null, y: null };

  function checkFace(axis, direction, coordinate, min, max) {
    if (velocity[axis] * direction <= 0) {
      return;
    }
    const time = (coordinate - movingPos[axis]) / velocity[axis];
    if (time < 0 || time > hit.time) {
      return;
    }
    const otherAxis = axis === "x" ? "y" : "x";
    const otherPosition = movingPos[otherAxis] + velocity[otherAxis] * time;
    if (otherPosition < min || otherPosition > max) {
      return;
    }
    if (time < hit.time) {
      hit.x = null;
      hit.y = null;
    }
    hit.time = time;
    hit[axis] = coordinate;
  }

  checkFace("x", 1, left, top, bottom);
  checkFace("x", -1, right, top, bottom);
  checkFace("y", 1, top, left, right);
  checkFace("y", -1, bottom, left, right);

  return hit.x === null && hit.y === null ? null : hit;
}

function moveBall(dt) {
  while (dt > 0) {
    // Avoid repeatedly triggering the getter
    const ballHitbox = ball.hitbox;
    let hitTime = dt;
    let hitX = null;
    let hitY = null;
    let contacts = [];

    for (const collider of colliders) {
      const hit = getCollision(ballHitbox, ball.vel, collider.hitbox, hitTime);
      if (hit === null) {
        continue;
      }
      if (hit.time < hitTime) {
        hitX = null;
        hitY = null;
        contacts = [];
      }
      hitTime = hit.time;
      hitX = hit.x ?? hitX;
      hitY = hit.y ?? hitY;
      contacts.push({ collider, hit });
    }

    ball.move(hitTime);
    dt -= hitTime;

    if (contacts.length === 0) {
      break;
    }
    // Snap the position to the point of contact to avoid floating point errors
    if (hitX !== null) {
      ball.pos.x = hitX + ball.size.w / 2;
    }
    if (hitY !== null) {
      ball.pos.y = hitY + ball.size.h / 2;
    }

    ball.onCollide({ x: hitX !== null, y: hitY !== null });
    for (const { collider, hit } of contacts) {
      collider.onCollide?.({ x: hit.x !== null, y: hit.y !== null });
    }
  }
}

