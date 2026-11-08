# Local tracking assets

MediaPipe model files are served from this directory so runtime camera tracking does not fetch a third-party model CDN. Package runtime: @mediapipe/tasks-vision 1.2.2. Three.js: 0.187.0. The predev/prebuild script copies WASM from the pinned installed package; the generated wasm directory is ignored.

| File | Official distribution | SHA-256 |
| --- | --- | --- |
| face_landmarker.task | https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task | 64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff |
| pose_landmarker_lite.task | https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task | 59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a |

These checked-in bytes, rather than the mutable latest URL, define this implementation. Review upstream model cards and distribution terms before redistribution. Google MediaPipe package licence notices remain in the installed dependency; Three.js is MIT licensed. These generic tracking models are not showroom jewellery assets and provide no identity recognition.
