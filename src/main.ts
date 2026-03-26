const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const fallback = document.getElementById('fallback') as HTMLDivElement;

async function init(): Promise<void> {
  if (!navigator.gpu) {
    statusEl.textContent = 'WebGPU not supported';
    fallback.style.display = 'block';
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    statusEl.textContent = 'No GPU adapter found';
    fallback.style.display = 'block';
    return;
  }

  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu') as GPUCanvasContext;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  const shaderCode = /* wgsl */`
    struct VertexOutput {
      @builtin(position) pos: vec4f,
      @location(0) color: vec3f,
    };

    @vertex fn vs_main(@builtin(vertex_index) i: u32) -> VertexOutput {
      var positions = array<vec2f, 3>(
        vec2f( 0.0,  0.5),
        vec2f(-0.5, -0.5),
        vec2f( 0.5, -0.5),
      );
      var colors = array<vec3f, 3>(
        vec3f(0.42, 0.72, 1.0),
        vec3f(0.18, 0.35, 0.65),
        vec3f(0.75, 0.90, 1.0),
      );
      var out: VertexOutput;
      out.pos = vec4f(positions[i], 0.0, 1.0);
      out.color = colors[i];
      return out;
    }

    @fragment fn fs_main(in: VertexOutput) -> @location(0) vec4f {
      return vec4f(in.color, 1.0);
    }
  `;

  const shaderModule = device.createShaderModule({ code: shaderCode });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex:   { module: shaderModule, entryPoint: 'vs_main' },
    fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });

  statusEl.textContent = `WebGPU ✓ — ${adapter.info?.vendor || 'GPU'} — Floe is alive`;

  function frame(): void {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.04, g: 0.04, b: 0.08, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});