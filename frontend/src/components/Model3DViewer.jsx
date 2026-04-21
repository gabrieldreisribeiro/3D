import { useEffect, useRef } from 'react';
import { resolveAssetUrl } from '../services/api';

function Model3DViewer({ fileUrl }) {
  const mountRef = useRef(null);

  useEffect(() => {
    let renderer;
    let scene;
    let camera;
    let controls;
    let frameId = null;
    let disposed = false;

    const mount = mountRef.current;
    if (!mount || !fileUrl) return undefined;

    const setup = async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');

      if (disposed) return;

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#f8fafc');

      const width = mount.clientWidth || 800;
      const height = mount.clientHeight || 460;
      camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
      camera.position.set(120, 100, 120);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = true;

      const ambient = new THREE.AmbientLight(0xffffff, 0.8);
      const directional = new THREE.DirectionalLight(0xffffff, 1.2);
      directional.position.set(120, 160, 100);
      scene.add(ambient, directional);

      const grid = new THREE.GridHelper(220, 24, '#dbe4f0', '#e5e7eb');
      scene.add(grid);

      const url = resolveAssetUrl(fileUrl) || fileUrl;
      const ext = String(url || '').toLowerCase().split('?')[0].split('.').pop();

      const fitObject = (object3d) => {
        const box = new THREE.Box3().setFromObject(object3d);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        object3d.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z, 1);
        camera.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.5);
        controls.target.set(0, 0, 0);
        controls.update();
      };

      if (ext === 'glb') {
        const loader = new GLTFLoader();
        loader.load(url, (gltf) => {
          if (disposed) return;
          scene.add(gltf.scene);
          fitObject(gltf.scene);
        });
      } else {
        const loader = new STLLoader();
        loader.load(url, (geometry) => {
          if (disposed) return;
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: '#7c3aed',
            metalness: 0.08,
            roughness: 0.42,
          });
          const mesh = new THREE.Mesh(geometry, material);
          scene.add(mesh);
          fitObject(mesh);
        });
      }

      const onResize = () => {
        if (!mount || !renderer || !camera) return;
        const nextWidth = mount.clientWidth || 800;
        const nextHeight = mount.clientHeight || 460;
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(nextWidth, nextHeight);
      };
      window.addEventListener('resize', onResize);

      const animate = () => {
        if (disposed || !renderer || !scene || !camera) return;
        controls?.update();
        renderer.render(scene, camera);
        frameId = window.requestAnimationFrame(animate);
      };
      animate();

      return () => {
        window.removeEventListener('resize', onResize);
      };
    };

    let cleanupResize = null;
    setup().then((cleanup) => {
      cleanupResize = cleanup || null;
    });

    return () => {
      disposed = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      if (cleanupResize) cleanupResize();
      controls?.dispose();
      renderer?.dispose();
      if (mount) mount.innerHTML = '';
    };
  }, [fileUrl]);

  return <div ref={mountRef} className="h-[420px] w-full rounded-2xl border border-slate-200 bg-slate-50" />;
}

export default Model3DViewer;
