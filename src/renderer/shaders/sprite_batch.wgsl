struct CameraUniforms {
    viewProjection: mat4x4<f32>,
};

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) uv:       vec2<f32>,
    @location(2) color:    vec4<f32>,
};

struct VertexOutput {
    @builtin(position) clipPos: vec4<f32>,
    @location(0)       vUV:     vec2<f32>,
    @location(1)       vColor:  vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.clipPos = camera.viewProjection * vec4<f32>(in.position, 0.0, 1.0);
    out.vUV     = in.uv;
    out.vColor  = in.color;
    return out;
}

@group(1) @binding(0) var texSampler: sampler;
@group(1) @binding(1) var texAtlas:   texture_2d<f32>;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let texColor = textureSample(texAtlas, texSampler, in.vUV);
    return texColor * in.vColor;
}
