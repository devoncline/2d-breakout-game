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
    pos = { x: 50, y: 50 };
    // vel = { x: 150, y: 150 };

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
        return {
            left: this.pos.x - this.size.w / 2,
            right: this.pos.x + this.size.w / 2,
            top: this.pos.y - this.size.h / 2,
            bottom: this.pos.y + this.size.h / 2,
        };
    }

    draw() {
        this.ctx.drawImage(
            this.asset,
            this.pos.x - this.size.w / 2,
            this.pos.y - this.size.h / 2,
        );
    }

    // move(dt) {
    //     this.pos.x += this.vel.x * dt;
    //     this.pos.y += this.vel.y * dt;
    // }

    // onCollide({ x, y }) {
    //     if (x) {
    //         this.vel.x = -this.vel.x;
    //     }
    //     if (y) {
    //         this.vel.y = -this.vel.y;
    //     }
    // }
}

class Ball extends GameObject {
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

const ball = new Ball("img/ball.png", ctx);

Promise.all([ball].map((obj) => obj.preload())).then(() =>
    requestAnimationFrame(update),
);

let lastTimestamp = null;
function update(timestamp) {
    const dt = lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    ball.move(dt);
    handleWallCollisions(ball, canvas.width, canvas.height);

    ctx.fillStyle = "#eeeeee";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ball.draw();

    requestAnimationFrame(update);
}

function handleWallCollisions(object, width, height) {
    const hitbox = object.hitbox;
    const hittingLeftBoundary = hitbox.left <= 0 && object.vel.x < 0;
    const hittingRightBoundary = hitbox.right >= width && object.vel.x > 0;
    const hittingTopBoundary = hitbox.top <= 0 && object.vel.y < 0;
    const hittingBottomBoundary = hitbox.bottom >= height && object.vel.y > 0;

    const x = hittingLeftBoundary || hittingRightBoundary;
    const y = hittingTopBoundary || hittingBottomBoundary;
    if (x || y) {
        object.onCollide({ x, y });
    }
}

