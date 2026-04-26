// engine/src/plugins/render/systems.ts
// 渲染系统

import type { World } from '../../core/world.js';
import type { EntityId } from '../../core/types.js';
import { Transform } from '../transform/plugin.js';
import { Sprite, Camera, SpriteAnimation, type AnimationDef } from './types.js';
import { SpriteBatch, type TextureAtlas } from './SpriteBatch.js';
import type { IGfxDevice } from './IGfxDevice.js';
import { Camera2D } from './Camera2D.js';
import { Color } from '../../math/index.js';

// ═════════════════════════════════════════════════════════════════════════════
// 动画系统
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 精灵动画系统 —— 更新动画帧
 */
export function spriteAnimationSystem(world: World, dt: number): void {
  const animations = world.getResource<Map<string, AnimationDef>>('animations');
  if (!animations) return;

  for (const eid of world.query(Sprite, SpriteAnimation)) {
    const sprite = world.get(eid, Sprite);
    const anim = world.get(eid, SpriteAnimation);

    if (!anim.playing || !anim.currentAnim) continue;

    const def = animations.get(anim.currentAnim);
    if (!def || def.frames.length === 0) continue;

    anim._accumulatedTime += dt * 1000 * anim.speed;

    // 检查是否切换帧
    const frameTime = def.frameDuration;
    if (anim._accumulatedTime >= frameTime) {
      anim._accumulatedTime = 0;
      anim._frameIndex++;

      // 处理循环
      if (anim._frameIndex >= def.frames.length) {
        if (anim.loop) {
          anim._frameIndex = 0;
        } else {
          anim._frameIndex = def.frames.length - 1;
          anim.playing = false;
        }
      }

      // 更新精灵区域
      sprite.region = def.frames[anim._frameIndex];
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 渲染系统
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 2D 精灵渲染系统
 * 
 * 收集所有可见精灵，使用 SpriteBatch 批量渲染
 */
export function spriteRenderSystem(world: World, dt: number): void {
  const renderer = world.getResource<Renderer>('renderer');
  if (!renderer) return;

  // 查找主相机
  let camera: Camera | null = null;
  let cameraTransform: Transform | null = null;

  for (const eid of world.query(Camera)) {
    camera = world.get(eid, Camera);
    if (world.has(eid, Transform)) {
      cameraTransform = world.get(eid, Transform);
    }
    break; // 使用第一个相机
  }

  if (!camera) return;

  // 更新相机2D参数
  renderer.camera2D.position.x = cameraTransform?.x ?? 0;
  renderer.camera2D.position.y = cameraTransform?.y ?? 0;
  renderer.camera2D.zoom = camera.zoom;
  renderer.camera2D.viewportWidth = camera.width;
  renderer.camera2D.viewportHeight = camera.height;
  renderer.camera2D.backgroundColor = camera.backgroundColor;
  renderer.camera2D.update(dt);

  const batch = renderer.batch;

  // SpriteBatch 内部管理 beginFrame/beginRenderPass
  // 但由于需要自定义 clearColor，我们需要特殊处理
  // 这里调用 begin，但需要修改 Camera2D 来携带 clearColor
  batch.begin(renderer.camera2D);

  // 相机参数
  const camX = cameraTransform?.x ?? 0;
  const camY = cameraTransform?.y ?? 0;
  const zoom = camera.zoom;

  // 计算视口边界（世界坐标）
  const halfViewW = (camera.width / 2) / zoom;
  const halfViewH = (camera.height / 2) / zoom;
  const viewLeft = camX - halfViewW;
  const viewRight = camX + halfViewW;
  const viewTop = camY - halfViewH;
  const viewBottom = camY + halfViewH;

  // 收集所有可见精灵
  const visibleSprites: Array<{
    eid: EntityId;
    sprite: Sprite;
    transform: Transform;
  }> = [];

  for (const eid of world.query(Sprite)) {
    const sprite = world.get(eid, Sprite);
    
    // 获取变换
    let transform: Transform;
    if (world.has(eid, Transform)) {
      transform = world.get(eid, Transform);
    } else {
      transform = new Transform();
    }

    // 视锥剔除（简单AABB检查）
    const halfW = 32 / zoom;
    const halfH = 32 / zoom;
    
    if (transform.x + halfW < viewLeft ||
        transform.x - halfW > viewRight ||
        transform.y + halfH < viewTop ||
        transform.y - halfH > viewBottom) {
      continue;
    }

    visibleSprites.push({ eid, sprite, transform });
  }

  // 按层排序
  visibleSprites.sort((a, b) => {
    if (a.sprite.layer !== b.sprite.layer) {
      return a.sprite.layer - b.sprite.layer;
    }
    return a.sprite.order - b.sprite.order;
  });

  // 提交到批次
  for (const { sprite, transform } of visibleSprites) {
    const atlas = renderer.getAtlas(sprite.atlas);
    if (!atlas) continue;

    const region = atlas.getRegion(sprite.region);

    batch.drawQuad(
      transform.x,
      transform.y,
      region.pixelWidth * transform.scaleX,
      region.pixelHeight * transform.scaleY,
      transform.rotation,
      region,
      atlas,
      sprite.color,
      sprite.flipX,
      sprite.flipY,
    );
  }

  batch.end();
}

// ═════════════════════════════════════════════════════════════════════════════
// 渲染器接口
// ═════════════════════════════════════════════════════════════════════════════

export interface Renderer {
  readonly device: IGfxDevice;
  readonly batch: SpriteBatch;
  readonly camera2D: Camera2D;

  /** 注册图集 */
  registerAtlas(name: string, atlas: TextureAtlas): void;
  /** 获取图集 */
  getAtlas(name: string): TextureAtlas | undefined;
  /** 加载图集 */
  loadAtlas(name: string, imageUrl: string, jsonUrl?: string): Promise<void>;
}
