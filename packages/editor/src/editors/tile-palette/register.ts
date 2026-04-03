import { registerEditor } from '../registry';
import { TilePaletteEditor } from './TilePaletteEditor';

registerEditor({
  id: 'tile-palette',
  name: 'Tile Palette',
  icon: '🎨',
  component: TilePaletteEditor,
});
