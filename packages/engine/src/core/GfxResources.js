export class GfxBuffer {
    gpuBuffer;
    size;
    constructor(device, desc) {
        this.size = desc.size;
        this.gpuBuffer = device.createBuffer({
            label: desc.label,
            size: desc.size,
            usage: desc.usage,
            mappedAtCreation: desc.mappedAtCreation ?? false,
        });
    }
    destroy() { this.gpuBuffer.destroy(); }
}
export class GfxTexture {
    gpuTexture;
    width;
    height;
    constructor(device, desc) {
        this.width = desc.width;
        this.height = desc.height;
        this.gpuTexture = device.createTexture({
            label: desc.label,
            size: [desc.width, desc.height],
            format: desc.format ?? 'rgba8unorm',
            usage: desc.usage ?? (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT),
        });
    }
    createView() { return this.gpuTexture.createView(); }
    destroy() { this.gpuTexture.destroy(); }
}
//# sourceMappingURL=GfxResources.js.map