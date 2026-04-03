import './editors/tile-palette/register';
import './editors/viewport/register';
import './editors/inspector/register';

import { LayoutRoot } from './components/LayoutRoot';

export function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div style={{
        height: 32,
        background: '#2a2a2a',
        borderBottom: '1px solid #111',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 12,
        fontWeight: 600,
        fontSize: 13,
        color: '#aaa',
        flexShrink: 0,
      }}>
        Mote Editor — 微尘
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <LayoutRoot />
      </div>
    </div>
  );
}
