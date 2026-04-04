import { signal, computed } from "@preact/signals";
import type { SpriteAtlas, SpriteFrame } from "../data/SpriteAtlas";

/** All loaded sprite atlases */
export const spriteAtlases = signal<SpriteAtlas[]>([]);

/** Atlas image cache: atlas.id -> HTMLImageElement */
export const atlasImages = signal<Map<string, HTMLImageElement>>(new Map());

/** Currently selected atlas ID (for the sprite panel) */
export const activeAtlasId = signal<string | null>(null);

/** Currently selected frame ID within the active atlas */
export const activeFrameId = signal<string | null>(null);

/** Get the active atlas object */
export const activeAtlas = computed((): SpriteAtlas | null => {
  const id = activeAtlasId.value;
  if (!id) return null;
  return spriteAtlases.value.find((a) => a.id === id) ?? null;
});

/** Get the active frame object */
export const activeFrame = computed((): SpriteFrame | null => {
  const atlas = activeAtlas.value;
  const fid = activeFrameId.value;
  if (!atlas || !fid) return null;
  return atlas.frameMap.get(fid) ?? null;
});

// ---- Atlas CRUD ----

export function addAtlas(atlas: SpriteAtlas, img: HTMLImageElement): void {
  spriteAtlases.value = [...spriteAtlases.value, atlas];
  const newImages = new Map(atlasImages.value);
  newImages.set(atlas.id, img);
  atlasImages.value = newImages;
  activeAtlasId.value = atlas.id;
}

export function removeAtlas(id: string): void {
  spriteAtlases.value = spriteAtlases.value.filter((a) => a.id !== id);
  const newImages = new Map(atlasImages.value);
  newImages.delete(id);
  atlasImages.value = newImages;
  if (activeAtlasId.value === id) {
    activeAtlasId.value = spriteAtlases.value[0]?.id ?? null;
  }
}
