const vertexShaderSource = /* glsl */ `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = /* glsl */ `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_texel;   // 1.0 / videoWidth
varying vec2 v_uv;

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 a = texture2D(u_tex, uv - vec2(0.5 * u_texel, 0.0)).rgb;
  vec3 b = texture2D(u_tex, uv + vec2(0.5 * u_texel, 0.0)).rgb;
  vec3 avg = (a + b) * 0.5;
  float y0 = dot(a, vec3(0.257, 0.504, 0.098)) + 16.0 / 255.0;
  float y1 = dot(b, vec3(0.257, 0.504, 0.098)) + 16.0 / 255.0;
  float u = dot(avg, vec3(-0.148, -0.291, 0.439)) + 0.5;
  float v = dot(avg, vec3(0.439, -0.368, -0.071)) + 0.5;
  gl_FragColor = vec4(u, y0, v, y1);
}
`;

export type UYVYFrame = {
  width: number;
  height: number;
  data: Uint8Array<ArrayBufferLike>;
};

export class WebGLRenderer {
  canvas: OffscreenCanvas | null;
  ctx: WebGLRenderingContext | null;

  constructor() {
    const target = new OffscreenCanvas(640, 480);
    const gl: WebGLRenderingContext | null =
      target instanceof HTMLCanvasElement ? target.getContext("webgl") : target.getContext("webgl");
    if (!gl) throw new Error("WebGL not supported");
    this.canvas = target;
    this.ctx = gl;

    if (!gl) {
      throw new Error("WebGL not supported");
    }
    this.ctx = gl;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) {
      throw new Error("Failed to create vertex shader");
    }
    gl.shaderSource(vertexShader, WebGLRenderer.vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      throw gl.getShaderInfoLog(vertexShader);
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      throw new Error("Failed to create fragment shader");
    }
    gl.shaderSource(fragmentShader, WebGLRenderer.fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      throw gl.getShaderInfoLog(fragmentShader);
    }

    const shaderProgram = gl.createProgram();
    if (!shaderProgram) {
      throw new Error("Failed to create shader program");
    }
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      throw gl.getProgramInfoLog(shaderProgram);
    }

    gl.useProgram(shaderProgram);

    // Vertex coordinates, clockwise from bottom-left.
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1.0, -1.0, -1.0, +1.0, +1.0, +1.0, +1.0, -1.0]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(shaderProgram, "a_position");
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLocation);

    // Create one texture to upload frames to.
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  static vertexShaderSource = vertexShaderSource;
  static fragmentShaderSource = fragmentShaderSource;

  draw(frame: VideoFrame): UYVYFrame {
    const width = frame.displayWidth & ~1;
    const height = frame.displayHeight;

    if (!width || !height || !this.canvas || !this.ctx) {
      return {
        width: 0,
        height: 0,
        data: new Uint8Array(0),
      };
    }

    const gl = this.ctx;

    this.canvas.width = width / 2;
    this.canvas.height = height;

    // upload the video frame to the texture
    gl.viewport(0, 0, width / 2, height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    gl.uniform1f(
      gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM), "u_texel"),
      1 / frame.displayWidth,
    );

    const data = new Uint8Array(width * height * 2);
    // flip the Y axis to match WebGL's coordinate system
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    gl.readPixels(0, 0, width / 2, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return {
      height,
      width: width / 2,
      data,
    };
  }

  destroy() {
    this.ctx?.getExtension("WEBGL_lose_context")?.loseContext();
    this.canvas = null;
    this.ctx = null;
  }
}
