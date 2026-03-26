// Vite ?raw import type declaration
declare module '*.wgsl?raw' {
  const content: string;
  export default content;
}
