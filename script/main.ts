interface IRenderable {
    visible: boolean;

    render(): void;
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

const ctx = gameCanvas.getContext("2d");
const renderables: Set<IRenderable> = new Set<IRenderable>();

let player: Player;
let stage: GameStage;
let leftOrRight: Direction = Direction.NONE;
let leftDown: boolean = false;
let rightDown: boolean = false;
let ticker: number;

class Player implements IRenderable {
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
        renderables.add(this);
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
            // Then we can draw the sprite (from its bottom left corner)
            ctx.drawImage(playerImage, -this.width / 2, -this.height / 2);

            // Restore the context state to exit the rotated and translated perspective
            ctx.restore();

            // Debug: show the sprite's center with a square
            // ctx.fillStyle = "pink";
            // ctx.fillRect(this.x-10, this.y-10, 20, 20);
        }
    }
}

type RenderFunction = () => void;

let renderFunction: RenderFunction = renderTitleScreen;

playerImage.src = "../img/player.png";
if (playerImage.complete) {
    init();
} else {
    playerImage.addEventListener("load", init);
}

function boundingBoxBottomLeftX(centerX: number, width: number, height: number, tilt: number): number {
    return centerX - (Math.abs(width * Math.cos(tilt) + height * Math.sin(tilt))) / 2;
}

function boundingBoxBottomLeftY(centerY: number, width: number, height: number, tilt: number): number {
    return centerY + (Math.abs(height * Math.cos(tilt) + width * Math.sin(tilt))) / 2;
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


    requestAnimationFrame(renderWrapper);

    // window.setTimeout(die, 1000);
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

    // die();

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
    player.forceAngle = (Math.random() - 0.5) * TILT_FLUCTUATION_FORCE_MAX + leftOrRight * PLAYER_TILT_CONTROL_FORCE;
    player.forceAngle -= Math.sign(player.speedAngle) * player.speedAngle ** 2 * player.airResistanceAngle;
    player.accelerationAngle = player.weight * player.forceAngle;
    player.speedAngle += player.accelerationAngle;
    player.tilt += player.speedAngle;
    player.tilt %= 2 * Math.PI;

    player.forceX = 0;
    player.forceY = GRAVITY;

    if (boundingBoxBottomLeftY(player.y, player.width, player.height, player.tilt) > HEIGHT) {
        if (Math.abs(player.tilt) >= Math.PI / 2) {
            die();
        } else {
            if (player.speedY > 0) {
                player.speedY = 0;
            }
            player.forceY = -JUMP_FORCE * Math.cos(player.tilt);
            player.forceX = JUMP_FORCE * Math.sin(player.tilt);
        }
    }

    // player.forceX = 0;
    player.forceX -= Math.sign(player.speedX) * player.speedX ** 2 * player.airResistanceX;
    player.accelerationX = player.forceX * player.weight;
    player.speedX += player.accelerationX;
    player.x += player.speedX;


    player.forceY -= Math.sign(player.speedY) * player.speedY ** 2 * player.airResistanceY;
    player.accelerationY = player.forceY * player.weight;
    player.speedY += player.accelerationY;
    // player.speedY = 0;
    player.y += player.speedY;


}
