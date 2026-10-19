
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
    loadPackage({"files": [{"filename": "/lights/level_a.json", "start": 0, "end": 12307}, {"filename": "/lights/level_h.json", "start": 12307, "end": 13358}, {"filename": "/lights/level_l.json", "start": 13358, "end": 13603}, {"filename": "/props/level_a.json", "start": 13603, "end": 20568}, {"filename": "/props/spaceship/models/captains_chair.obj", "start": 20568, "end": 171499}, {"filename": "/props/spaceship/models/cargo_crate.obj", "start": 171499, "end": 256798}, {"filename": "/props/spaceship/models/crew_bunk.obj", "start": 256798, "end": 373552}, {"filename": "/props/spaceship/models/crew_chair.obj", "start": 373552, "end": 479592}, {"filename": "/props/spaceship/models/crew_locker.obj", "start": 479592, "end": 544445}, {"filename": "/props/spaceship/models/equipment_case.obj", "start": 544445, "end": 597417}, {"filename": "/props/spaceship/models/hologram_projector.obj", "start": 597417, "end": 631746}, {"filename": "/props/spaceship/models/maintenance_bench.obj", "start": 631746, "end": 776076}, {"filename": "/props/spaceship/models/navigation_console.obj", "start": 776076, "end": 819572}, {"filename": "/props/spaceship/models/oxygen_tanks.obj", "start": 819572, "end": 917150}, {"filename": "/props/spaceship/models/power_unit.obj", "start": 917150, "end": 976824}, {"filename": "/props/spaceship/models/server_rack.obj", "start": 976824, "end": 1066175}, {"filename": "/props/spaceship/models/wall_terminal.obj", "start": 1066175, "end": 1087700}, {"filename": "/props/spaceship/textures/spaceship_base_color.png", "start": 1087700, "end": 1238749}, {"filename": "/props/spaceship/textures/spaceship_emissive.png", "start": 1238749, "end": 1241523}, {"filename": "/props/spaceship/textures/spaceship_metalness.png", "start": 1241523, "end": 1244812}, {"filename": "/props/spaceship/textures/spaceship_normal.png", "start": 1244812, "end": 1248871}, {"filename": "/props/spaceship/textures/spaceship_orm.png", "start": 1248871, "end": 1401877}, {"filename": "/props/spaceship/textures/spaceship_roughness.png", "start": 1401877, "end": 1559933}, {"filename": "/renderer_dxr/enemies/alien2/model.json", "start": 1559933, "end": 1560508}, {"filename": "/renderer_dxr/enemies/alien2/skin.png", "start": 1560508, "end": 1600989}, {"filename": "/renderer_dxr/enemies/alien2/tris.md2", "start": 1600989, "end": 1660037}, {"filename": "/renderer_dxr/enemies/guard/model.json", "start": 1660037, "end": 1660827}, {"filename": "/renderer_dxr/enemies/guard/skin_2.png", "start": 1660827, "end": 1705054}, {"filename": "/renderer_dxr/enemies/guard/skin_3.png", "start": 1705054, "end": 1741313}, {"filename": "/renderer_dxr/enemies/guard/skin_4.png", "start": 1741313, "end": 1777605}, {"filename": "/renderer_dxr/enemies/guard/skin_5.png", "start": 1777605, "end": 1819931}, {"filename": "/renderer_dxr/enemies/guard/tris.md2", "start": 1819931, "end": 1874567}, {"filename": "/renderer_dxr/materials/material_runtime.bin", "start": 1874567, "end": 30899169}, {"filename": "/renderer_dxr/pickups/blaster_clip/model.json", "start": 30899169, "end": 30899580}, {"filename": "/renderer_dxr/pickups/blaster_clip/skin.png", "start": 30899580, "end": 30902685}, {"filename": "/renderer_dxr/pickups/blaster_clip/tris.md2", "start": 30902685, "end": 30908165}, {"filename": "/renderer_dxr/pickups/grenades/model.json", "start": 30908165, "end": 30908560}, {"filename": "/renderer_dxr/pickups/grenades/skin.png", "start": 30908560, "end": 30911646}, {"filename": "/renderer_dxr/pickups/grenades/tris.md2", "start": 30911646, "end": 30927718}, {"filename": "/renderer_dxr/pickups/lazer_clip/model.json", "start": 30927718, "end": 30928114}, {"filename": "/renderer_dxr/pickups/lazer_clip/skin.png", "start": 30928114, "end": 30930835}, {"filename": "/renderer_dxr/pickups/lazer_clip/tris.md2", "start": 30930835, "end": 30937731}, {"filename": "/renderer_dxr/pickups/medikit/model.json", "start": 30937731, "end": 30938109}, {"filename": "/renderer_dxr/pickups/medikit/skin.png", "start": 30938109, "end": 30941678}, {"filename": "/renderer_dxr/pickups/medikit/tris.md2", "start": 30941678, "end": 30948298}, {"filename": "/renderer_dxr/pickups/mine/model.json", "start": 30948298, "end": 30948686}, {"filename": "/renderer_dxr/pickups/mine/skin.png", "start": 30948686, "end": 30951642}, {"filename": "/renderer_dxr/pickups/mine/tris.md2", "start": 30951642, "end": 30962834}, {"filename": "/renderer_dxr/pickups/plasma_clip/model.json", "start": 30962834, "end": 30963235}, {"filename": "/renderer_dxr/pickups/plasma_clip/skin.png", "start": 30963235, "end": 30964142}, {"filename": "/renderer_dxr/pickups/plasma_clip/tris.md2", "start": 30964142, "end": 30970138}, {"filename": "/renderer_dxr/pickups/rifle_clip/model.json", "start": 30970138, "end": 30970541}, {"filename": "/renderer_dxr/pickups/rifle_clip/skin.png", "start": 30970541, "end": 30974853}, {"filename": "/renderer_dxr/pickups/rifle_clip/tris.md2", "start": 30974853, "end": 30977237}, {"filename": "/renderer_dxr/pickups/rocket/model.json", "start": 30977237, "end": 30977613}, {"filename": "/renderer_dxr/pickups/rocket/skin.png", "start": 30977613, "end": 30980418}, {"filename": "/renderer_dxr/pickups/rocket/tris.md2", "start": 30980418, "end": 30986918}, {"filename": "/renderer_dxr/pickups/shotgun_shells/model.json", "start": 30986918, "end": 30987317}, {"filename": "/renderer_dxr/pickups/shotgun_shells/skin.png", "start": 30987317, "end": 30990081}, {"filename": "/renderer_dxr/pickups/shotgun_shells/tris.md2", "start": 30990081, "end": 30995921}, {"filename": "/renderer_dxr/player/README.md", "start": 30995921, "end": 30999491}, {"filename": "/renderer_dxr/player/grunt.png", "start": 30999491, "end": 31038161}, {"filename": "/renderer_dxr/player/source.json", "start": 31038161, "end": 31038749}, {"filename": "/renderer_dxr/player/tris.md2", "start": 31038749, "end": 31317341}, {"filename": "/renderer_dxr/sky_equirectangular.png", "start": 31317341, "end": 33647112}], "remote_package_size": 33647112});

  })();
