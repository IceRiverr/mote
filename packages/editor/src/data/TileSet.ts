export interface TileSet {
  id: string;
  name: string;
  imageUrl: string;        // ObjectURL or data URL
  imageWidth: number;
  imageHeight: number;
  tileWidth: number;
  tileHeight: number;
  margin: number;
  spacing: number;
  columns: number;
  rows: number;
  tileCount: number;
}

/** Calculate derived fields from image dimensions + tile config */
export function createTileSet(
  id: string,
  name: string,
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  tileWidth: number,
  tileHeight: number,
  margin = 0,
  spacing = 0
): TileSet {
  const columns = Math.floor(
    (imageWidth - margin * 2 + spacing) / (tileWidth + spacing)
  );
  const rows = Math.floor(
    (imageHeight - margin * 2 + spacing) / (tileHeight + spacing)
  );
  return {
    id,
    name,
    imageUrl,
    imageWidth,
    imageHeight,
    tileWidth,
    tileHeight,
    margin,
    spacing,
    columns,
    rows,
    tileCount: columns * rows,
  };
}

/** Get the source rect of a tile in the spritesheet */
export function getTileSrcRect(
  ts: TileSet,
  localId: number
): { sx: number; sy: number; sw: number; sh: number } {
  const col = localId % ts.columns;
  const row = Math.floor(localId / ts.columns);
  return {
    sx: ts.margin + col * (ts.tileWidth + ts.spacing),
    sy: ts.margin + row * (ts.tileHeight + ts.spacing),
    sw: ts.tileWidth,
    sh: ts.tileHeight,
  };
}
