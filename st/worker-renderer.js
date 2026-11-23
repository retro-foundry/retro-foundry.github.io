function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
  if (!gl) throw new Error('Could not open the worker playfield graphics');
  const shader = (kind, code) => {
    const compiled = gl.createShader(kind);
    gl.shaderSource(compiled, code);
    gl.compileShader(compiled);
    if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(compiled));
    return compiled;
  };
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, `
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 texel;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
      texel = uv;
    }`));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D bitmap;
    varying vec2 texel;
    void main() {
      gl_FragColor = texture2D(bitmap, texel).bgra;
    }`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 0, 1, 1, -1, 1, 1,
    -1,  1, 0, 0, 1,  1, 1, 0,
  ]), gl.STATIC_DRAW);
  for (const [name, offset] of [['position', 0], ['uv', 8]]) {
    const index = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(index, 2, gl.FLOAT, false, 16, offset);
  }
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  let textureWidth = 0;
  let textureHeight = 0;

  let fullUpload = true;
  function upload(heap, pixels, width, first, end) {
    const pitch = width * 4;
    const start = pixels + first * pitch;
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, first, width, end - first, gl.RGBA, gl.UNSIGNED_BYTE,
                     heap.subarray(start, pixels + end * pitch));
  }

  function draw(heap, pixels, width, height, changed, sameFramebuffer) {
    if (width !== textureWidth || height !== textureHeight) {
      textureWidth = canvas.width = width;
      textureHeight = canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      fullUpload = true;
    }
    let needsDraw = fullUpload || !changed || !sameFramebuffer;
    if (needsDraw) {
      upload(heap, pixels, width, 0, height);
    } else {
      for (let first = 0; first < height;) {
        while (first < height && !heap[changed + first]) ++first;
        if (first === height) break;
        let end = first + 1;
        // Upload small gaps with their neighbours to avoid a separate WebGL call.
        for (let row = end; row < height && row - end <= 4; ++row) {
          if (heap[changed + row]) end = row + 1;
        }
        upload(heap, pixels, width, first, end);
        needsDraw = true;
        first = end;
      }
    }
    fullUpload = false;
    // The canvas already presents this image when every row is unchanged.
    if (needsDraw) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  return { draw, reset() { fullUpload = true; } };
}
