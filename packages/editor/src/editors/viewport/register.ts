import { registerEditor } from '../registry';
import { ViewportEditor } from './ViewportEditor';

registerEditor({
  id: 'viewport',
  name: 'Viewport',
  icon: '🗺',
  component: ViewportEditor,
});
