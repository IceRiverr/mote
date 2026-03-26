import { GfxBuffer, GfxTexture } from './GfxResources.js';
export class GfxDevice {
    device;
    context;
    format;
    constructor(_adapter, device, context, format) {
        this.device = device;
        this.context = context;
        this.format = format;
    }
    static async create(canvas) {
        if (!navigator.gpu)
            throw new Error('WebGPU not supported');
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter)
            throw new Error('No GPU adapter found');
        const device = await adapter.requestDevice();
        const context = canvas.getContext('webgpu');
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: 'premultiplied' });
        return new GfxDevice(adapter, device, context, format);
    }
    createBuffer(desc) {
        return new GfxBuffer(this.device, desc);
    }
    createTexture(desc) {
        return new GfxTexture(this.device, desc);
    }
    // Load an image URL into a GPU texture
    async loadTexture(url) {
        const img = new Image();
        img.src = url;
        await img.decode();
        const bitmap = await createImageBitmap(img);
        const tex = new GfxTexture(this.device, {
            label: url,
            width: bitmap.width,
            height: bitmap.height,
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.device.queue.copyExternalImageToTexture({ source: bitmap }, { texture: tex.gpuTexture }, [bitmap.width, bitmap.height]);
        bitmap.close();
        return tex;
    }
    writeBuffer(buffer, data, byteOffset = 0) {
        this.device.queue.writeBuffer(buffer.gpuBuffer, byteOffset, data);
    }
    getCurrentTextureView() {
        return this.context.getCurrentTexture().createView();
    }
    destroy() {
        this.device.destroy();
    }
}
//# sourceMappingURL=GfxDevice.js.map