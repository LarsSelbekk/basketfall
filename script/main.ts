interface IRenderable {
    visible: boolean;
    z: number;

    render(): void;
}

interface ICenteredRotatableComponent {
    x: number;
    y: number;
    width: number;
    height: number;
    tilt: number;
}

interface ITickable {
    tick(): void;
}

type LinearForce = { magnitude: number, angle: number };
type Torque = number;

class PhysicsObject {
    x: number;
    y: number;
    z: number;
    tilt: number = 0;
    readonly width: number;
    readonly height: number;
    readonly weight: number;
    readonly airResistanceAngle: number;
    readonly airResistanceX: number;
    readonly airResistanceY: number;
    speedX: number = 0;
    speedY: number = 0;
    speedAngle: number = 0;
    accelerationAngle: number = 0;
    accelerationX: number = 0;
    accelerationY: number = 0;
    forceAngle: number = 0;
    forceX: number = 0;
    forceY: number = 0;
    private linearForces: LinearForce[] = [];
    private angularForces: Torque[] = [];


    constructor(x: number, y: number, z: number, width: number, height: number, weight: number, airResistanceAngle: number, airResistanceX: number,
                airResistanceY: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.width = width;
        this.height = height;
        this.weight = weight;
        this.airResistanceAngle = airResistanceAngle;
        this.airResistanceX = airResistanceX;
        this.airResistanceY = airResistanceY;
    }

    clearLinearForces(): void {
        this.linearForces = [];
    }

    clearAngularForces(): void {
        this.angularForces = [];
    }

    addForce(force: LinearForce): void {
        this.linearForces.push(force);
    }

    computeForceX(): void {
        let sum = 0;
        for (const force of this.linearForces) {
            sum += force.magnitude * Math.sin(force.angle);
        }
        this.forceX = sum;
    }

    computeForceY(): void {
        let sum = 0;
        for (const force of this.linearForces) {
            sum -= force.magnitude * Math.cos(force.angle);
        }
        this.forceY = sum;
    }

    addTorque(torque: Torque): void {
        this.angularForces.push(torque);
    }

    computeTorque(): void {
        this.forceAngle = this.angularForces.reduce((n, x) => n + x, 0);
    }

    computeAcceleration(force: number): number {
        return force * this.weight;
    }

    computeAngularAcceleration(): void {
        this.accelerationAngle = this.computeAcceleration(this.forceAngle);
    }

    computeAccelerationX(): void {
        this.accelerationX = this.computeAcceleration(this.forceX);
    }

    computeAccelerationY(): void {
        this.accelerationY = this.computeAcceleration(this.forceY);
    }

    computeSpeedAngle(): void {
        this.speedAngle += this.accelerationAngle;
    }

    computeTilt(): void {
        this.tilt += this.speedAngle;
    }

    computeSpeedX(): void {
        this.speedX += this.accelerationX;
    }

    computeX(): void {
        this.x += this.speedX;
    }

    computeSpeedY(): void {
        this.speedY += this.accelerationY;
    }

    computeY(): void {
        this.y += this.speedY;
    }
}

enum GameStage {
    TitleScreen,
    Game,
    DeathScreen,
}

enum Direction {
    LEFT = -1,
    NONE = 0,
    RIGHT = 1,
}

const WIDTH = 1280;
const HEIGHT = 720;

const GRAVITY = 0.00981 * 2.5;
const JUMP_FORCE = 0.08 / 2;
const BOUNCE_FACTOR = 0.9;
const TILT_FLUCTUATION_FORCE_MAX = 1e-6;
const PLAYER_TILT_CONTROL_FORCE = 1e-6;
const TICK_INTERVAL = 1000 / 600;

const TITLE_WIDTH = 500;
const TITLE_FONT = "Cambria";
const gameCanvas = document.getElementById("game") as HTMLCanvasElement;

const playerImage = document.createElement("img");
const hoopImage = document.createElement("img");
const ballImage = document.createElement("img");
const basketImage = document.createElement("img");
const tryningsVideo = document.createElement("video");

const ctx = gameCanvas.getContext("2d");
const renderables: IRenderable[] = [];
const balls: Ball[] = [];

let goals: number = 0;
let player: Player;
let hoop: Hoop;
let basket: Basket;
let stage: GameStage;
let leftOrRight: Direction = Direction.NONE;
let leftDown: boolean = false;
let rightDown: boolean = false;
let ticker: number;

function removeRenderable(renderable: IRenderable): void {
    const index = renderables.indexOf(renderable);
    if (index >= 0) {
        renderables.splice(index, 1);
    }
    renderables.sort((a, b) => a.z - b.z);
}

class Player extends PhysicsObject implements IRenderable, ICenteredRotatableComponent, ITickable {
    visible: boolean = false;
    attachedBall: Ball = null;

    constructor(x: number, y: number, z: number = 0, weight: number = 120) {
        super(x, y, z, playerImage.width, playerImage.height, weight, 0.0075, 0.00001, 0.000005);
        this.x = x;
        this.y = y;
        this.z = z;
        registerRenderable(this);
    }

    tick(): void {
        this.clearAngularForces();
        this.addTorque((Math.random() - 0.5) * TILT_FLUCTUATION_FORCE_MAX + leftOrRight * PLAYER_TILT_CONTROL_FORCE);
        this.addTorque(-Math.sign(this.speedAngle) * this.speedAngle ** 2 * this.airResistanceAngle);
        this.computeTorque();
        this.computeAngularAcceleration();
        this.computeSpeedAngle();
        this.computeTilt();

        this.clearLinearForces();
        this.addForce({magnitude: GRAVITY/this.weight, angle: Math.PI});

        if (boundingBoxBottomY(this) > HEIGHT) {
            if (Math.abs(this.tilt) >= Math.PI / 2) {
                die();
            } else if (bottomRightCornerY(this) > HEIGHT){
                if (this.speedY > 0) {
                    this.speedY = 0;
                }
                this.computeForceY();
                this.addForce({magnitude: -this.forceY, angle: 0});
                this.addForce({magnitude: JUMP_FORCE*Math.abs(Math.cos(this.tilt)), angle: this.tilt});
                // this.forceY = -JUMP_FORCE * Math.cos(this.tilt);
                // this.forceX = JUMP_FORCE * Math.sin(this.tilt);
            }
        }

        this.addForce({
            magnitude: -Math.sign(this.speedX) * this.speedX ** 2 * this.airResistanceX,
            angle: Math.PI / 2,
        });
        this.computeForceX();
        this.computeAccelerationX();
        this.computeSpeedX();
        this.computeX();


        this.addForce({magnitude: Math.sign(this.speedY) * this.speedY ** 2 * this.airResistanceY, angle: 0});
        this.computeForceY();
        this.computeAccelerationY();
        this.computeSpeedY();
        this.computeY();
    }

    render(): void {
        if (this.visible) {
            // Save context state so we can return to it later
            ctx.save();

            // Change context perspective to draw sprite rotated around its center
            // First center on the sprite's center
            ctx.translate(this.x, this.y);
            // Then rotate the perspective
            ctx.rotate(this.tilt);
            // Then we can draw the sprite (from its top left corner)
            ctx.drawImage(playerImage, -this.width / 2, -this.height / 2);

            // Restore the context state to exit the rotated and translated perspective
            ctx.restore();

            // Debug: show the sprite's center with a square
            // ctx.fillStyle = "pink";
            // ctx.fillRect(this.x - 10, this.y - 10, 20, 20);

            // Debug: show corners
            // const bottomLeftX = bottomLeftCornerX(this);
            // const bottomLeftY = bottomLeftCornerY(this);
            // const bottomRightX = bottomRightCornerX(this);
            // const bottomRightY = bottomRightCornerY(this);
            // const topRightX = topRightCornerX(this);
            // const topRightY = topRightCornerY(this);
            // const topLeftX = topLeftCornerX(this);
            // const topLeftY = topLeftCornerY(this);
            // ctx.fillStyle = "red";
            // ctx.fillRect(bottomLeftX - 10, bottomLeftY - 10, 20, 20);
            // ctx.fillStyle = "orange";
            // ctx.fillRect(bottomRightX - 10, bottomRightY - 10, 20, 20);
            // ctx.fillStyle = "yellow";
            // ctx.fillRect(topRightX - 10, topRightY - 10, 20, 20);
            // ctx.fillStyle = "brown";
            // ctx.fillRect(topLeftX - 10, topLeftY - 10, 20, 20);
        }
    }
}

class Ball extends PhysicsObject implements IRenderable, ITickable {
    visible: boolean;
    attachedPlayer: Player = null;
    contacting: boolean = false;

    attach(player: Player) {
        this.attachedPlayer = player;
        player.attachedBall = this;
        this.tick();
    }

    detach(): void {
        const arm = Math.sqrt((this.x - this.attachedPlayer.x)**2 + (this.y - this.attachedPlayer.y)**2);
        this.speedX = this.attachedPlayer.speedX + this.attachedPlayer.speedAngle * arm * Math.cos(this.attachedPlayer.tilt);
        this.speedY = this.attachedPlayer.speedY + this.attachedPlayer.speedAngle * arm * Math.sin(this.attachedPlayer.tilt);

        if (basket !== undefined && basket !== null && ballInBasket(this, basket)) {
            this.speedX = 0;
            goals++;
        }
        this.attachedPlayer.attachedBall = null;
        this.attachedPlayer = null;
    }

    constructor(x: number, y: number, z: number = -2) {
        super(x, y, z, ballImage.width, ballImage.height, 20, 1e-10, 1e-5, 1e-5);
        registerRenderable(this);
        balls.push(this);
    }

    tick(): void {
        if (this.attachedPlayer !== null) {
            this.x = topLeftCornerX(this.attachedPlayer);
            this.y = topLeftCornerY(this.attachedPlayer);
        } else {
            this.clearLinearForces();

            if (this.y + this.height > HEIGHT) {
            //     if (this.speedY > 0) {
            //         this.speedY = 0;
            //     }
            //     this.computeForceY();
            //     this.addForce({magnitude: -this.forceY, angle: 0});
            //     this.addForce({magnitude: JUMP_FORCE, angle: this.tilt});
                // this.forceY = -JUMP_FORCE * Math.cos(this.tilt);
                // this.forceX = JUMP_FORCE * Math.sin(this.tilt);
                balls.splice(balls.indexOf(this));
                removeRenderable(this);
                new Ball(0,0).attach(player);
                balls[0].visible = true;
            }

            if (ballInBasket(this, basket)) {
                this.speedX = 0;
                if (!this.contacting) {
                    this.speedY = 0;
                    console.log(++goals);
                }
                this.contacting = true;

            } else {
                this.contacting = false;
            }
            this.addForce({magnitude: GRAVITY/this.weight, angle: Math.PI});


            this.addForce({
                magnitude: -Math.sign(this.speedX) * this.speedX ** 2 * this.airResistanceX,
                angle: Math.PI / 2,
            });
            this.computeForceX();
            this.computeAccelerationX();
            this.computeSpeedX();
            this.computeX();


            this.addForce({magnitude: Math.sign(this.speedY) * this.speedY ** 2 * this.airResistanceY, angle: 0});
            this.computeForceY();
            this.computeAccelerationY();
            this.computeSpeedY();
            this.computeY();
        }
    }

    render(): void {
        if (this.visible) {
            ctx.save();
            ctx.translate(this.x, this.y);
            if (this.attachedPlayer !== null) {
                ctx.rotate(this.attachedPlayer.tilt);
            }
            ctx.drawImage(ballImage, 0, 0);
            ctx.restore();

            // Debug: show the sprite's center with a square
            // ctx.fillStyle = "pink";
            // ctx.fillRect(this.x + this.width / 2 - 10, this.y + this.height / 2 - 10, 20, 20);
        }
    }

}

function ballInBasket(ball: Ball, basket: Basket): boolean {
    const topHorizontalOff = 3;
    // return basket.x < ball.x &&
    //     ball.x < basket.x + basket.width &&
    //     basket.y < ball.y &&
    //     ball.y < basket.y + basket.height;
    return ball.x > basket.x + topHorizontalOff + (ball.y-basket.y)*(basket.width - topHorizontalOff * 2) / (2 * basket.height) &&
        ball.x < basket.x  - topHorizontalOff + basket.width/2 + (ball.y-basket.y)*(basket.width - topHorizontalOff * 2) / (2*basket.height) &&
        ball.y < basket.y + basket.height &&
        ball.y > basket.y;
}

class Hoop implements IRenderable {
    visible: boolean = false;
    x: number;
    y: number;
    z: number;
    readonly width: number = hoopImage.width;
    readonly height: number = hoopImage.height;

    constructor(x: number, y: number, z: number = -3) {
        this.x = x;
        this.y = y;
        this.z = z;
        registerRenderable(this);
    }

    render(): void {
        if (this.visible) {
            ctx.drawImage(hoopImage, this.x, this.y);
        }
    }
}

class Basket implements IRenderable {
    visible: boolean = false;
    x: number;
    y: number;
    z: number;
    readonly width: number = basketImage.width;
    readonly height: number = basketImage.height;

    constructor(x: number, y: number, z: number = -1) {
        this.x = x;
        this.y = y;
        this.z = z;
        registerRenderable(this);
    }

    render(): void {
        if (this.visible) {
            ctx.drawImage(basketImage, this.x, this.y);
        }
    }
}

type RenderFunction = () => void;

let renderFunction: RenderFunction = renderTitleScreen;

playerImage.src = "img/player.png";
hoopImage.src = "img/hoop.png";
ballImage.src = "img/ball.png";
basketImage.src = "img/basket.png";
tryningsVideo.src = "video/trynings_bak.mp4";
tryningsVideo.loop = true;

const images: HTMLImageElement[] = [playerImage, hoopImage, ballImage, basketImage];

function tryInit(): void {
    for (const image of images) {
        if (!image.complete) {
            image.addEventListener("load", tryInit);
            return;
        }
    }
    init();
}

tryInit();

function bottomLeftCornerX(b: ICenteredRotatableComponent): number {
    return b.x - (b.width * Math.cos(b.tilt) + b.height * Math.sin(b.tilt)) / 2;
}

function topLeftCornerX(b: ICenteredRotatableComponent): number {
    return 2 * b.x - bottomRightCornerX(b);
}

function topRightCornerX(b: ICenteredRotatableComponent): number {
    return 2 * b.x - bottomLeftCornerX(b);
}

function bottomRightCornerX(b: ICenteredRotatableComponent): number {
    return b.x - Math.sin(b.tilt - Math.atan(b.width / b.height)) * Math.sqrt(b.height ** 2 + b.width ** 2) / 2;
}

function bottomLeftCornerY(b: ICenteredRotatableComponent): number {
    return b.y + Math.cos(b.tilt + Math.atan(b.width / b.height)) * Math.sqrt(b.height ** 2 + b.width ** 2) / 2;
}

function topLeftCornerY(b: ICenteredRotatableComponent): number {
    return 2 * b.y - bottomRightCornerY(b);
}

function topRightCornerY(b: ICenteredRotatableComponent): number {
    return 2 * b.y - bottomLeftCornerY(b);
}

function bottomRightCornerY(b: ICenteredRotatableComponent): number {
    return b.y + Math.sqrt(b.height ** 2 + b.width ** 2) * Math.cos(b.tilt - Math.atan(b.width / b.height)) / 2;
}

function boundingBoxBottomY(b: ICenteredRotatableComponent): number {
    return Math.max(bottomLeftCornerY(b), bottomRightCornerY(b), topRightCornerY(b), topLeftCornerY(b));
}

function updateDirection(): void {
    if (leftDown) {
        if (rightDown) {
            leftOrRight = Direction.NONE;
        } else {
            leftOrRight = Direction.LEFT;
        }
    } else if (rightDown) {
        leftOrRight = Direction.RIGHT;
    } else {
        leftOrRight = Direction.NONE;
    }
}

function init(): void {
    gameCanvas.height = HEIGHT;
    gameCanvas.width = WIDTH;

    player = new Player(WIDTH / 2, HEIGHT / 2);
    new Ball(0, 0).attach(player);
    hoop = new Hoop(WIDTH/2 - hoopImage.width/2, HEIGHT-hoopImage.height);
    basket = new Basket(hoop.x, hoop.y+68);

    openTitleScreen();

    gameCanvas.addEventListener("click", nextStage);

    document.addEventListener("keydown", e => {
        if (e.key === "ArrowLeft") {
            leftDown = true;
            e.preventDefault();
        } else if (e.key === "ArrowRight") {
            rightDown = true;
            e.preventDefault();
        }

        updateDirection();
    });

    document.addEventListener("keyup", e => {
        if (e.key === "ArrowLeft") {
            leftDown = false;
        } else if (e.key === "ArrowRight") {
            rightDown = false;
        }

        updateDirection();
    });

    document.addEventListener("keypress", e => {
        if (e.key === " ") {
            if (player.attachedBall !== null) {
                const ball = player.attachedBall;
                player.attachedBall.detach();

                ball.clearLinearForces();
                ball.addForce({magnitude: JUMP_FORCE*5, angle: player.tilt});
                ball.computeForceX();
                ball.computeForceY();
                ball.computeAccelerationX();
                ball.computeAccelerationY();
                ball.computeSpeedX();
                ball.computeSpeedY();
                ball.computeX();
                ball.computeY();
            }
            e.preventDefault();
        } else if (e.key === "e" || e.key === "E") {
            if (player.attachedBall !== null) {
                player.attachedBall.detach();
            }
            e.preventDefault();
        }
    });


    requestAnimationFrame(renderWrapper);

}

function registerRenderable(target: IRenderable): void {
    renderables.push(target);
    renderables.sort((a, b) => a.z - b.z);
}

function nextStage(): void {
    switch (stage) {
        case GameStage.DeathScreen:
            break;
        case GameStage.Game:
            die();
            break;
        case GameStage.TitleScreen:
            startGame();
            break;
    }
}

function die(): void {
    window.clearInterval(ticker);
    console.log("deaded");
    stage = GameStage.DeathScreen;
    renderFunction = renderDeathScreen;
    tryningsVideo.play().catch(() => console.error("Couldn't play death clip."));
}

function renderWrapper() {
    switch (stage) {
        case GameStage.DeathScreen:
            renderDeathScreen();
            break;
        case GameStage.Game:
            renderGame();
            renderSprites();
            renderGameOverlay();
            break;
        case GameStage.TitleScreen:
            renderTitleScreen();
            break;
    }


    requestAnimationFrame(renderWrapper);
}

function openTitleScreen(): void {
    stage = GameStage.TitleScreen;
}

function startGame(): void {
    stage = GameStage.Game;
    player.visible = true;
    hoop.visible = true;
    basket.visible = true;
    for (const ball of balls) {
        ball.visible = true;
    }
    ticker = window.setInterval(tick, TICK_INTERVAL);

}

function renderGame(): void {
    ctx.fillStyle = "gray";
    ctx.fillRect(0, 0, WIDTH - 1, HEIGHT - 1);
}

function renderGameOverlay(): void {
    ctx.fillStyle = "black";
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("🏀" + goals, WIDTH/2, 15, 100);
}

function renderTitleScreen(): void {
    ctx.fillStyle = "beige";
    ctx.fillRect(0, 0, WIDTH - 1, HEIGHT - 1);

    const title = "BasketFall";

    ctx.font = TITLE_WIDTH + "px " + TITLE_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "black";

    ctx.fillText(title, WIDTH / 2, 500, TITLE_WIDTH);
}

function renderDeathScreen(): void {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, WIDTH - 1, HEIGHT - 1);

    ctx.drawImage(
        tryningsVideo,
        WIDTH / 2 - tryningsVideo.videoWidth / 2,
        HEIGHT / 2 - tryningsVideo.videoHeight / 2);
    ctx.font = TITLE_WIDTH + "px " + TITLE_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "red";
    ctx.fillText("TOT", WIDTH / 2, 500, TITLE_WIDTH);

    renderables.forEach(r => r.visible = false);
}

function renderSprites(): void {
    renderables.forEach(r => r.render());
}

function tick(): void {
    player.tick();
    for (const ball of balls) {
        ball.tick();
    }
}
