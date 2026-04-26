// engine/src/math/mat4.ts

// Column-major 4x4 matrix (matches WebGPU/WGSL convention)
export class Mat4 {
  readonly data: Float32Array;

  constructor(data?: Float32Array) {
    this.data = data ?? new Float32Array(16);
  }

  static identity(): Mat4 {
    const m = new Mat4();
    m.data[0] = 1; m.data[5] = 1; m.data[10] = 1; m.data[15] = 1;
    return m;
  }

  static ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
    const m = new Mat4();
    const d = m.data;
    d[0]  =  2 / (right - left);
    d[5]  =  2 / (top - bottom);
    d[10] = -2 / (far - near);
    d[12] = -(right + left) / (right - left);
    d[13] = -(top + bottom) / (top - bottom);
    d[14] = -(far + near)   / (far - near);
    d[15] = 1;
    return m;
  }

  static multiply(a: Mat4, b: Mat4): Mat4 {
    const out = new Mat4();
    const A = a.data, B = b.data, C = out.data;
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += A[k * 4 + row] * B[col * 4 + k];
        C[col * 4 + row] = sum;
      }
    }
    return out;
  }

  static translation(x: number, y: number): Mat4 {
    const m = Mat4.identity();
    m.data[12] = x;
    m.data[13] = y;
    return m;
  }

  static scaling(sx: number, sy: number): Mat4 {
    const m = Mat4.identity();
    m.data[0] = sx;
    m.data[5] = sy;
    return m;
  }

  static rotationZ(angle: number): Mat4 {
    const m = Mat4.identity();
    const c = Math.cos(angle), s = Math.sin(angle);
    m.data[0] =  c; m.data[4] = -s;
    m.data[1] =  s; m.data[5] =  c;
    return m;
  }
}
