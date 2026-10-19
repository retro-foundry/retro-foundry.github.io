
  var Module = typeof Module != 'undefined' ? Module : {};

  if (!Module['expectedDataFileDownloads']) Module['expectedDataFileDownloads'] = 0;
  Module['expectedDataFileDownloads']++;
  (() => {
    // Do not attempt to redownload the virtual filesystem data when in a pthread or a Wasm Worker context.
    var isPthread = typeof ENVIRONMENT_IS_PTHREAD != 'undefined' && ENVIRONMENT_IS_PTHREAD;
    var isWasmWorker = typeof ENVIRONMENT_IS_WASM_WORKER != 'undefined' && ENVIRONMENT_IS_WASM_WORKER;
    if (isPthread || isWasmWorker) return;
    async function loadPackage(metadata) {

      var PACKAGE_PATH = '';
      if (typeof window === 'object') {
        PACKAGE_PATH = window['encodeURIComponent'](window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) + '/');
      } else if (typeof process === 'undefined' && typeof location !== 'undefined') {
        // web worker
        PACKAGE_PATH = encodeURIComponent(location.pathname.substring(0, location.pathname.lastIndexOf('/')) + '/');
      }
      var PACKAGE_NAME = 'C:/Users/paula/Documents/Projects/alienbreed3d2/build/web-webgpu/ab3d2_renderer.data';
      var REMOTE_PACKAGE_BASE = 'ab3d2_renderer.data';
      var REMOTE_PACKAGE_NAME = Module['locateFile'] ? Module['locateFile'](REMOTE_PACKAGE_BASE, '') : REMOTE_PACKAGE_BASE;
      var REMOTE_PACKAGE_SIZE = metadata['remote_package_size'];

      async function fetchRemotePackage(packageName, packageSize) {
        
        if (!Module['dataFileDownloads']) Module['dataFileDownloads'] = {};
        try {
          var response = await fetch(packageName);
        } catch (e) {
          throw new Error(`Network Error: ${packageName}`, {e});
        }
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.url}`);
        }

        const chunks = [];
        const headers = response.headers;
        const total = Number(headers.get('Content-Length') || packageSize);
        let loaded = 0;

        Module['setStatus'] && Module['setStatus']('Downloading data...');
        const reader = response.body.getReader();

        while (1) {
          var {done, value} = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          Module['dataFileDownloads'][packageName] = {loaded, total};

          let totalLoaded = 0;
          let totalSize = 0;

          for (const download of Object.values(Module['dataFileDownloads'])) {
            totalLoaded += download.loaded;
            totalSize += download.total;
          }

          Module['setStatus'] && Module['setStatus'](`Downloading data... (${totalLoaded}/${totalSize})`);
        }

        const packageData = new Uint8Array(chunks.map((c) => c.length).reduce((a, b) => a + b, 0));
        let offset = 0;
        for (const chunk of chunks) {
          packageData.set(chunk, offset);
          offset += chunk.length;
        }
        return packageData.buffer;
      }

      var fetchPromise;
      var fetched = Module['getPreloadedPackage'] && Module['getPreloadedPackage'](REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE);

      if (!fetched) {
        // Note that we don't use await here because we want to execute the
        // the rest of this function immediately.
        fetchPromise = fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE);
      }

    async function runWithFS(Module) {

      function assert(check, msg) {
        if (!check) throw new Error(msg);
      }
Module['FS_createPath']("/", "lights", true, true);
Module['FS_createPath']("/", "props", true, true);
Module['FS_createPath']("/props", "spaceship", true, true);
Module['FS_createPath']("/props/spaceship", "models", true, true);
Module['FS_createPath']("/props/spaceship", "textures", true, true);
Module['FS_createPath']("/", "renderer_dxr", true, true);
Module['FS_createPath']("/renderer_dxr", "enemies", true, true);
Module['FS_createPath']("/renderer_dxr/enemies", "alien2", true, true);
Module['FS_createPath']("/renderer_dxr/enemies", "guard", true, true);
Module['FS_createPath']("/renderer_dxr", "materials", true, true);
Module['FS_createPath']("/renderer_dxr", "pickups", true, true);
Module['FS_createPath']("/renderer_dxr/pickups", "blaster_clip", true, true);
Module['FS_createPath']("/renderer_dxr/pickups", "grenades", true, true);
Module['FS_createPath']("/renderer_dxr/pickups", "lazer_clip", true, true);
Module['FS_createPath']("/renderer_dxr/pickups", "medikit", true, true);
Module['FS_createPath']("/renderer_dxr/pickups", "mine", true, true);
Module['FS_createPath']("/renderer_dxr/pickups", "plasma_clip", true, true);
Module['FS_createPath']("/renderer_dxr/pickups", "rifle_clip", true, true);
Module['FS_createPath']("/renderer_dxr/pickups", "rocket", true, true);
Module['FS_createPath']("/renderer_dxr/pickups", "shotgun_shells", true, true);
Module['FS_createPath']("/renderer_dxr", "player", true, true);

    for (var file of metadata['files']) {
      var name = file['filename']
      Module['addRunDependency'](`fp ${name}`);
    }

      async function processPackageData(arrayBuffer) {
        assert(arrayBuffer, 'Loading data file failed.');
        assert(arrayBuffer.constructor.name === ArrayBuffer.name, 'bad input to processPackageData ' + arrayBuffer.constructor.name);
        var byteArray = new Uint8Array(arrayBuffer);
        var curr;
        // Reuse the bytearray from the XHR as the source for file reads.
          for (var file of metadata['files']) {
            var name = file['filename'];
            var data = byteArray.subarray(file['start'], file['end']);
            // canOwn this data in the filesystem, it is a slice into the heap that will never change
        Module['FS_createDataFile'](name, null, data, true, true, true);
        Module['removeRunDependency'](`fp ${name}`);
          }
          Module['removeRunDependency']('datafile_C:/Users/paula/Documents/Projects/alienbreed3d2/build/web-webgpu/ab3d2_renderer.data');
      }
      Module['addRunDependency']('datafile_C:/Users/paula/Documents/Projects/alienbreed3d2/build/web-webgpu/ab3d2_renderer.data');

      if (!Module['preloadResults']) Module['preloadResults'] = {};

      Module['preloadResults'][PACKAGE_NAME] = {fromCache: false};
      if (!fetched) {
        fetched = await fetchPromise;
      }
      processPackageData(fetched);

    }
    if (Module['calledRun']) {
      runWithFS(Module);
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module['preRun'].push(runWithFS); // FS is not initialized yet, wait for it
    }

    }
    loadPackage({"files": [{"filename": "/lights/level_a.json", "start": 0, "end": 12307}, {"filename": "/lights/level_h.json", "start": 12307, "end": 13358}, {"filename": "/lights/level_l.json", "start": 13358, "end": 13603}, {"filename": "/props/level_a.json", "start": 13603, "end": 20568}, {"filename": "/props/spaceship/models/captains_chair.obj", "start": 20568, "end": 171499}, {"filename": "/props/spaceship/models/cargo_crate.obj", "start": 171499, "end": 256798}, {"filename": "/props/spaceship/models/crew_bunk.obj", "start": 256798, "end": 373552}, {"filename": "/props/spaceship/models/crew_chair.obj", "start": 373552, "end": 479592}, {"filename": "/props/spaceship/models/crew_locker.obj", "start": 479592, "end": 544445}, {"filename": "/props/spaceship/models/equipment_case.obj", "start": 544445, "end": 597417}, {"filename": "/props/spaceship/models/hologram_projector.obj", "start": 597417, "end": 631746}, {"filename": "/props/spaceship/models/maintenance_bench.obj", "start": 631746, "end": 776076}, {"filename": "/props/spaceship/models/navigation_console.obj", "start": 776076, "end": 819572}, {"filename": "/props/spaceship/models/oxygen_tanks.obj", "start": 819572, "end": 917150}, {"filename": "/props/spaceship/models/power_unit.obj", "start": 917150, "end": 976824}, {"filename": "/props/spaceship/models/server_rack.obj", "start": 976824, "end": 1066175}, {"filename": "/props/spaceship/models/wall_terminal.obj", "start": 1066175, "end": 1087700}, {"filename": "/props/spaceship/textures/spaceship_base_color.png", "start": 1087700, "end": 1238749}, {"filename": "/props/spaceship/textures/spaceship_emissive.png", "start": 1238749, "end": 1241523}, {"filename": "/props/spaceship/textures/spaceship_metalness.png", "start": 1241523, "end": 1244812}, {"filename": "/props/spaceship/textures/spaceship_normal.png", "start": 1244812, "end": 1248871}, {"filename": "/props/spaceship/textures/spaceship_orm.png", "start": 1248871, "end": 1401877}, {"filename": "/props/spaceship/textures/spaceship_roughness.png", "start": 1401877, "end": 1559933}, {"filename": "/renderer_dxr/enemies/alien2/model.json", "start": 1559933, "end": 1560508}, {"filename": "/renderer_dxr/enemies/alien2/skin.png", "start": 1560508, "end": 1600989}, {"filename": "/renderer_dxr/enemies/alien2/tris.md2", "start": 1600989, "end": 1660037}, {"filename": "/renderer_dxr/enemies/guard/model.json", "start": 1660037, "end": 1660827}, {"filename": "/renderer_dxr/enemies/guard/skin_2.png", "start": 1660827, "end": 1705054}, {"filename": "/renderer_dxr/enemies/guard/skin_3.png", "start": 1705054, "end": 1741313}, {"filename": "/renderer_dxr/enemies/guard/skin_4.png", "start": 1741313, "end": 1777605}, {"filename": "/renderer_dxr/enemies/guard/skin_5.png", "start": 1777605, "end": 1819931}, {"filename": "/renderer_dxr/enemies/guard/tris.md2", "start": 1819931, "end": 1874567}, {"filename": "/renderer_dxr/materials/material_runtime.bin", "start": 1874567, "end": 66262868}, {"filename": "/renderer_dxr/pickups/blaster_clip/model.json", "start": 66262868, "end": 66263279}, {"filename": "/renderer_dxr/pickups/blaster_clip/skin.png", "start": 66263279, "end": 66266384}, {"filename": "/renderer_dxr/pickups/blaster_clip/tris.md2", "start": 66266384, "end": 66271864}, {"filename": "/renderer_dxr/pickups/grenades/model.json", "start": 66271864, "end": 66272259}, {"filename": "/renderer_dxr/pickups/grenades/skin.png", "start": 66272259, "end": 66275345}, {"filename": "/renderer_dxr/pickups/grenades/tris.md2", "start": 66275345, "end": 66291417}, {"filename": "/renderer_dxr/pickups/lazer_clip/model.json", "start": 66291417, "end": 66291813}, {"filename": "/renderer_dxr/pickups/lazer_clip/skin.png", "start": 66291813, "end": 66294534}, {"filename": "/renderer_dxr/pickups/lazer_clip/tris.md2", "start": 66294534, "end": 66301430}, {"filename": "/renderer_dxr/pickups/medikit/model.json", "start": 66301430, "end": 66301808}, {"filename": "/renderer_dxr/pickups/medikit/skin.png", "start": 66301808, "end": 66305377}, {"filename": "/renderer_dxr/pickups/medikit/tris.md2", "start": 66305377, "end": 66311997}, {"filename": "/renderer_dxr/pickups/mine/model.json", "start": 66311997, "end": 66312385}, {"filename": "/renderer_dxr/pickups/mine/skin.png", "start": 66312385, "end": 66315341}, {"filename": "/renderer_dxr/pickups/mine/tris.md2", "start": 66315341, "end": 66326533}, {"filename": "/renderer_dxr/pickups/plasma_clip/model.json", "start": 66326533, "end": 66326934}, {"filename": "/renderer_dxr/pickups/plasma_clip/skin.png", "start": 66326934, "end": 66327841}, {"filename": "/renderer_dxr/pickups/plasma_clip/tris.md2", "start": 66327841, "end": 66333837}, {"filename": "/renderer_dxr/pickups/rifle_clip/model.json", "start": 66333837, "end": 66334240}, {"filename": "/renderer_dxr/pickups/rifle_clip/skin.png", "start": 66334240, "end": 66338552}, {"filename": "/renderer_dxr/pickups/rifle_clip/tris.md2", "start": 66338552, "end": 66340936}, {"filename": "/renderer_dxr/pickups/rocket/model.json", "start": 66340936, "end": 66341312}, {"filename": "/renderer_dxr/pickups/rocket/skin.png", "start": 66341312, "end": 66344117}, {"filename": "/renderer_dxr/pickups/rocket/tris.md2", "start": 66344117, "end": 66350617}, {"filename": "/renderer_dxr/pickups/shotgun_shells/model.json", "start": 66350617, "end": 66351016}, {"filename": "/renderer_dxr/pickups/shotgun_shells/skin.png", "start": 66351016, "end": 66353780}, {"filename": "/renderer_dxr/pickups/shotgun_shells/tris.md2", "start": 66353780, "end": 66359620}, {"filename": "/renderer_dxr/player/README.md", "start": 66359620, "end": 66363190}, {"filename": "/renderer_dxr/player/grunt.png", "start": 66363190, "end": 66401860}, {"filename": "/renderer_dxr/player/source.json", "start": 66401860, "end": 66402448}, {"filename": "/renderer_dxr/player/tris.md2", "start": 66402448, "end": 66681040}, {"filename": "/renderer_dxr/sky_equirectangular.png", "start": 66681040, "end": 69010811}], "remote_package_size": 69010811});

  })();
