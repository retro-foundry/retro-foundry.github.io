# Third-party notices: the WebGPU web build

What the browser build (`AB3D2_ENABLE_WEBGPU=ON`) compiles in or ships, with
pinned versions and licences. The native D3D12/DXR build's own dependencies
(Streamline, Dear ImGui, the blue-noise sampler) are documented beside that
build and are not part of the web build.

| Component | Version | Licence | Where | Used for |
|---|---|---|---|---|
| pmndrs/upscaler WGSL passes | commit `96184a6812bc5fd5e5fd7898257788a1663105a9` | MIT; FSR-derived passes carry AMD's MIT notice | `third_party/pmndrs_upscaler/` | Temporal (FSR 2/3-architecture) and spatial (FSR1 EASU + RCAS) upscaling |
| AMD FidelityFX Super Resolution 1/2/3 (via pmndrs/upscaler) | — | MIT | notice in `third_party/pmndrs_upscaler/LICENSE` | Algorithms the above passes port |
| Dawn emdawnwebgpu (webgpu.h / webgpu_cpp.h bindings) | Dawn release v20251002.162335, as pinned by Emscripten 5.0.0 | BSD-3-Clause | `docs/third_party/dawn-emdawnwebgpu-BSD-3-Clause.txt` | C++ access to the browser's WebGPU |
| SDL2 (Emscripten port) | as pinned by Emscripten 5.0.0 | zlib | — | Window, input, audio |
| stb_image | as vendored in `third_party/` | MIT / public domain | `third_party/` | PNG decoding |
| Emscripten runtime | 5.0.0 | MIT / University of Illinois NCSA | — | Compiler runtime and JS glue |

Written for this project and not derived from third-party code: the software
BVH builder and traversal (`src/renderer_webgpu/wgpu_bvh.*`,
`shaders/scene.wgsl`), the path tracer (`shaders/path_trace.wgsl`, which
follows the project's own DXR shader), the SVGF denoiser
(`shaders/svgf_*.wgsl`, from Schied et al., HPG 2017, and Dammertz et al.,
HPG 2010), and the tone curve port (`shaders/tonemap.wgsl`, from the
project's own DXR post-processing, itself after Eilertsen, Mantiuk and
Unger's minimum-contrast-distortion operator as Q2RTX uses it).

Not used, deliberately:

- **NVIDIA NRD** (ReBLUR/ReLAX): source-available under NVIDIA's RTX SDK
  terms, not an open-source licence.
- **OpenDLSS-NR** (maanHimself/OpenDLSS-NR): its code is MIT, but it runs
  NVIDIA's proprietary DLSS 5 Neural Rendering weights, which it does not
  include and which cannot be redistributed; it is also a generative
  re-renderer rather than a denoiser or upscaler, and measured 72 ms at
  512x512 in its own WebGPU port. See `docs/webgpu-port-status.md`.
