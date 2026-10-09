const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let lastTimestamp = null;
let score = 0;
let lives = 3;
let showLifeLostText = false;

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
];

class GameObject {
    static assets = new Map();
    url;
    asset;
    ctx;
    size = { w: undefined, h: undefined };
    pos = { x: 0, y: 0 };
    origin = { x: 0.5, y: 0.5 };

    constructor(url, ctx) {
        this.url = url;
        this.ctx = ctx;
    }

    async preload() {
        if (!GameObject.assets.has(this.url)) {
            const asset = new Image();
            asset.src = this.url;
            GameObject.assets.set(
                this.url,
                asset.decode().then(() => asset),
            );
        }
        this.asset = await GameObject.assets.get(this.url);
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
    size = { w: 20, h: 20 };
    wobbleFrames = [0, 1, 0, 2, 0, 1, 0, 2, 0];
    wobbleTime = null;
    pos = { x: undefined, y: undefined };
    vel = { x: 150, y: -150 };

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
    playWobble() {
        this.wobbleTime = 0;
    }
    updateAnimation(dt) {
        if (this.wobbleTime === null) {
            return;
        }
        this.wobbleTime += dt;
        if (this.wobbleTime >= this.wobbleFrames.length * (1 / 24)) {
            this.wobbleTime = null;
        }
    }
    draw() {
        const frame =
            this.wobbleTime === null
                ? 0
                : this.wobbleFrames[Math.floor(this.wobbleTime / (1 / 24))];
        const { left, top } = this.hitbox;
        this.ctx.drawImage(
            this.asset,
            frame * this.size.w,
            0,
            this.size.w,
            this.size.h,
            left,
            top,
            this.size.w,
            this.size.h,
        );
    }

}

class Paddle extends GameObject {
    origin = { x: 0.5, y: 1 };

    constructor(url, ctx) {
        super(url, ctx);
        this.pos = { x: ctx.canvas.width / 2, y: ctx.canvas.height - 5 };
    }
    onCollide() {
        ball.playWobble();
    }
}

class Brick extends GameObject {
    constructor(url, ctx, x, y, w, h) {
        super(url, ctx);
        this.pos = { x, y };
        this.size = { w, h };
    }
    draw() {
        const { left, top } = this.hitbox;
        this.ctx.drawImage(this.asset, left, top, this.size.w, this.size.h);
    }

    onCollide() {
        ball.playWobble();
        bricks.splice(bricks.indexOf(this), 1);
        colliders.splice(colliders.indexOf(this), 1);
        score += 10;
    }
}

const ball = new Ball("img/wobble.png", ctx);
const paddle = new Paddle("img/paddle.png", ctx);
colliders.push(paddle);
const bricks = initBricks();
for (const brick of bricks) {
    colliders.push(brick);
}



canvas.addEventListener("pointermove", (event) => {
    if (paddle.size.w === undefined) {
        return;
    }
    const bounds = canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) * canvas.width) / bounds.width;
    paddle.pos.x = Math.max(
        paddle.size.w / 2,
        Math.min(canvas.width - paddle.size.w / 2, x),
    );
});

Promise.all([ball, paddle, ...bricks].map((obj) => obj.preload())).then(() => {
    ball.pos.x = paddle.pos.x;
    ball.pos.y = paddle.hitbox.top - ball.size.h / 2;
    requestAnimationFrame(update);
});

function update(timestamp) {
    const dt = lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    ball.updateAnimation(dt);
    moveBall(dt);

    ctx.fillStyle = "#eeeeee";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ball.draw();
    paddle.draw();

    for (const brick of bricks) {
        brick.draw();
    }
    drawStatus();

    if (bricks.length === 0) {
        alert("You won the game, congratulations!");
        location.reload();
        return;
    }

    requestAnimationFrame(update);
}

function drawStatus() {
    ctx.font = "18px Arial";
    ctx.fillStyle = "#0095dd";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(`Points: ${score}`, 5, 5);

    ctx.textAlign = "right";
    ctx.fillText(`Lives: ${lives}`, canvas.width - 5, 5);

    if (showLifeLostText) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            "Life lost, click to continue",
            canvas.width / 2,
            canvas.height / 2,
        );
    }
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

    function checkFace(axis, coordinate, min, max, direction) {
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

    checkFace("x", left, top, bottom, 1);
    checkFace("x", right, top, bottom, -1);
    checkFace("y", top, left, right, 1);
    checkFace("y", bottom, left, right, -1);

    return hit.x === null && hit.y === null ? null : hit;
}

function moveBall(dt) {
    while (dt > 0 && bricks.length > 0) {
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

        const ballIsOutOfBounds = ball.hitbox.bottom > canvas.height;
        if (ballIsOutOfBounds) {
            ballLeaveScreen();
            return;
        }

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

function initBricks() {
    const bricksLayout = {
        width: 50,
        height: 20,
        count: {
            row: 3,
            col: 7,
        },
        offset: {
            top: 50,
            left: 60,
        },
        padding: 10,
    };
    const bricks = [];
    for (let c = 0; c < bricksLayout.count.col; c++) {
        for (let r = 0; r < bricksLayout.count.row; r++) {
            const brickX =
                c * (bricksLayout.width + bricksLayout.padding) +
                bricksLayout.offset.left;
            const brickY =
                r * (bricksLayout.height + bricksLayout.padding) +
                bricksLayout.offset.top;

            const newBrick = new Brick(
                "img/brick.png",
                ctx,
                brickX,
                brickY,
                bricksLayout.width,
                bricksLayout.height,
            );
            bricks.push(newBrick);
        }
    }
    return bricks;
}

function ballLeaveScreen() {
    lives--;
    if (lives === 0) {
        // Game over logic
        location.reload();
        return;
    }

    paddle.pos.x = canvas.width / 2;
    ball.pos.x = paddle.pos.x;
    ball.pos.y = paddle.hitbox.top - ball.size.h / 2;
    ball.vel = { x: 0, y: 0 };
    showLifeLostText = true;
    canvas.addEventListener(
        "pointerdown",
        () => {
            showLifeLostText = false;
            ball.vel = { x: 150, y: -150 };
            lastTimestamp = null;
        },
        { once: true },
    );
}

