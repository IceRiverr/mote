// scripts/game-manager.ts - Core game state management

export class GameManager {
  score = 0;
  lives = 3;
  speed = 120;           // pixels per second scroll speed
  paused = false;
  gameOver = false;
  difficultyLevel = 1;   // 1-5, increases over time
  combo = 0;
  comboTimer = 0;
  totalDistance = 0;

  // Difficulty scaling
  private difficultyTimer = 0;
  private readonly DIFFICULTY_INTERVAL = 15; // seconds between difficulty bumps
  private readonly MAX_SPEED = 320;
  private readonly SPEED_INCREMENT = 20;

  reset() {
    this.score = 0;
    this.lives = 3;
    this.speed = 120;
    this.paused = false;
    this.gameOver = false;
    this.difficultyLevel = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.totalDistance = 0;
    this.difficultyTimer = 0;
  }

  update(dt: number) {
    if (this.gameOver || this.paused) return;

    this.totalDistance += this.speed * dt;

    // Combo decay
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    // Difficulty ramping
    this.difficultyTimer += dt;
    if (this.difficultyTimer >= this.DIFFICULTY_INTERVAL) {
      this.difficultyTimer -= this.DIFFICULTY_INTERVAL;
      this.difficultyLevel = Math.min(5, this.difficultyLevel + 1);
      this.speed = Math.min(this.MAX_SPEED, this.speed + this.SPEED_INCREMENT);
    }

    // Distance-based score
    this.score += Math.floor(this.speed * dt * 0.1);
  }

  addScore(points: number) {
    this.combo++;
    this.comboTimer = 2.0; // 2 seconds to keep combo alive
    const multiplier = Math.min(this.combo, 5);
    this.score += points * multiplier;
  }

  loseLife() {
    this.lives--;
    this.combo = 0;
    if (this.lives <= 0) {
      this.gameOver = true;
    }
  }

  hitObstacle() {
    // Slow down temporarily on hit
    this.speed = Math.max(80, this.speed - 30);
  }

  getComboMultiplier(): number {
    return Math.min(this.combo, 5);
  }
}
