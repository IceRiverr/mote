// ═══════════════════════════════════════════════════════════════
// register.ts - 注册 Content Browser 到编辑器系统
// ═══════════════════════════════════════════════════════════════

import { registerEditor } from '../registry';
import { ContentBrowser } from './ContentBrowser';
import { ContentBrowserHeader } from './ContentBrowserHeader';

registerEditor({
  id: 'content-browser',
  name: '资源',
  icon: '📦',
  component: ContentBrowser,
  header: ContentBrowserHeader,
});
