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

const GRAVITY = 0.000981 / 5;
const JUMP_FORCE = 0.08 / 2;
const TILT_FLUCTUATION_FORCE_MAX = 1e-6;
const PLAYER_TILT_CONTROL_FORCE = 1e-6;
const TICK_INTERVAL = 1000 / 600;

const TITLE_WIDTH = 500;
const TITLE_FONT = "Cambria";
const gameCanvas = document.getElementById("game") as HTMLCanvasElement;

const video_trynings_bak = document.getElementById("video_trynings_bak") as HTMLVideoElement;
const playerImage = document.createElement("img");
const hoopImage = document.createElement("img");
const ballImage = document.createElement("img");
const basketImage = document.createElement("img");

const ctx = gameCanvas.getContext("2d");
const renderables: IRenderable[] = [];
const balls: Ball[] = [];

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

class Player implements IRenderable, ICenteredRotatableComponent, ITickable {
    readonly width: number = playerImage.width;
    readonly height: number = playerImage.height;
    readonly weight: number;
    readonly airResistanceAngle: number = 0.0075;
    readonly airResistanceX: number = 0.00001;
    readonly airResistanceY: number = 0.000005;
    x: number;
    y: number;
    z: number;
    tilt: number = 0;
    visible: boolean = false;
    speedX: number = 0;
    speedY: number = 0;
    speedAngle: number = 0;
    accelerationAngle: number = 0;
    accelerationX: number = 0;
    accelerationY: number = GRAVITY;
    forceAngle: number = 0;
    forceX: number = 0;
    forceY: number = 0;

    constructor(x: number, y: number, z: number = 0, weight: number = 120) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.weight = weight;
        registerRenderable(this);
    }

    tick(): void {
        this.forceAngle = (Math.random() - 0.5) * TILT_FLUCTUATION_FORCE_MAX + leftOrRight * PLAYER_TILT_CONTROL_FORCE;
        this.forceAngle -= Math.sign(this.speedAngle) * this.speedAngle ** 2 * this.airResistanceAngle;
        this.accelerationAngle = this.weight * this.forceAngle;
        this.speedAngle += this.accelerationAngle;
        this.tilt += this.speedAngle;
        this.tilt %= 2 * Math.PI;

        this.forceX = 0;
        this.forceY = GRAVITY;

        if (boundingBoxBottomY(this) > HEIGHT) {
            if (Math.abs(this.tilt) >= Math.PI / 2) {
                die();
            } else {
                if (this.speedY > 0) {
                    this.speedY = 0;
                }
                this.forceY = -JUMP_FORCE * Math.cos(this.tilt);
                this.forceX = JUMP_FORCE * Math.sin(this.tilt);
            }
        }

        this.forceX -= Math.sign(this.speedX) * this.speedX ** 2 * this.airResistanceX;
        this.accelerationX = this.forceX * this.weight;
        this.speedX += this.accelerationX;
        this.x += this.speedX;


        this.forceY -= Math.sign(this.speedY) * this.speedY ** 2 * this.airResistanceY;
        this.accelerationY = this.forceY * this.weight;
        this.speedY += this.accelerationY;
        // this.speedY = 0;
        this.y += this.speedY;
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
            ctx.fillStyle = "pink";
            ctx.fillRect(this.x - 10, this.y - 10, 20, 20);

            const bottomLeftX = bottomLeftCornerX(this);
            const bottomLeftY = bottomLeftCornerY(this);
            const bottomRightX = bottomRightCornerX(this);
            const bottomRightY = bottomRightCornerY(this);
            const topRightX = topRightCornerX(this);
            const topRightY = topRightCornerY(this);
            const topLeftX = topLeftCornerX(this);
            const topLeftY = topLeftCornerY(this);

            ctx.fillStyle = "red";
            ctx.fillRect(bottomLeftX - 10, bottomLeftY - 10, 20, 20);
            ctx.fillStyle = "orange";
            ctx.fillRect(bottomRightX - 10, bottomRightY - 10, 20, 20);
            ctx.fillStyle = "yellow";
            ctx.fillRect(topRightX - 10, topRightY - 10, 20, 20);
            ctx.fillStyle = "brown";
            ctx.fillRect(topLeftX - 10, topLeftY - 10, 20, 20);
        }
    }
}

class Ball implements IRenderable, ITickable {
    visible: boolean;
    x: number;
    y: number;
    z: number;
    attachedPlayer: Player = null;
    width: number = ballImage.width;
    height: number = ballImage.height;

    attach(player: Player) {
        this.attachedPlayer = player;
        // removeRenderable(this);
    }

    unAttach(): void {
        // registerRenderable(this);
        this.attachedPlayer = null;
    }

    constructor(x: number, y: number, z: number = -2) {
        this.x = x;
        this.y = y;
        this.z = z;
        registerRenderable(this);
        balls.push(this);
    }

    tick(): void {
        if (this.attachedPlayer !== null) {
            this.x = topLeftCornerX(this.attachedPlayer);
            this.y = topLeftCornerY(this.attachedPlayer);
        }
    }

    render(): void {
        if (this.visible) {
            ctx.save();
            ctx.translate(this.x,this.y);
            if (this.attachedPlayer !== null) {
                ctx.rotate(this.attachedPlayer.tilt);
            }
            ctx.drawImage(ballImage, 0, 0);
            ctx.restore();

            // Debug: show the sprite's center with a square
            ctx.fillStyle = "pink";
            ctx.fillRect(this.x + this.width / 2 - 10, this.y + this.height / 2 - 10, 20, 20);
        }
    }

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

playerImage.src = "../img/player.png";
hoopImage.src = "../img/hoop.png";
ballImage.src = "../img/ball.png";
basketImage.src = "../img/basket.png";

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
    return b.y + Math.sqrt(b.height ** 2 + b.width ** 2) * Math.cos(b.tilt - Math.atan(b.width/b.height)) / 2;
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
    hoop = new Hoop(40, 10);
    basket = new Basket(hoop.x, hoop.y - hoop.height + basketImage.height);

    openTitleScreen();

    gameCanvas.addEventListener("click", nextStage);

    document.addEventListener("keydown", e => {
        if (e.key === "ArrowLeft") {
            leftDown = true;
        } else if (e.key === "ArrowRight") {
            rightDown = true;
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
            balls[0].unAttach();
            // e.stopPropagation();
            // e.stopImmediatePropagation();
            e.preventDefault();
            // return false;
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
    video_trynings_bak.play().catch(() => console.error("Couldn't play death clip."));
}

function renderWrapper() {
    switch (stage) {
        case GameStage.DeathScreen:
            renderDeathScreen();
            break;
        case GameStage.Game:
            renderGame();
            break;
        case GameStage.TitleScreen:
            renderTitleScreen();
            break;
    }

    renderables.forEach(r => r.render());
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

function renderGame() {
    ctx.fillStyle = "gray";
    ctx.fillRect(0, 0, WIDTH - 1, HEIGHT - 1);
}

function renderTitleScreen(): void {
    ctx.fillStyle = "beige";
    ctx.fillRect(0, 0, WIDTH - 1, HEIGHT - 1);

    const title = "BasketFall";

    ctx.font = TITLE_WIDTH + "px " + TITLE_FONT;
    ctx.textAlign = "center";
    ctx.fillStyle = "black";

    ctx.fillText(title, WIDTH / 2, 500, TITLE_WIDTH);
}

function renderDeathScreen(): void {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, WIDTH - 1, HEIGHT - 1);

    ctx.drawImage(
        video_trynings_bak,
        WIDTH / 2 - video_trynings_bak.videoWidth / 2,
        HEIGHT / 2 - video_trynings_bak.videoHeight / 2);
    ctx.font = TITLE_WIDTH + "px " + TITLE_FONT;
    ctx.textAlign = "center";
    ctx.fillStyle = "red";
    ctx.fillText("TOT", WIDTH / 2, 500, TITLE_WIDTH);

    renderables.forEach(r => r.visible = false);
}

function tick(): void {
    player.tick();
    for (const ball of balls) {
        ball.tick();
    }
}
