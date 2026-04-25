import { useEffect, useRef, useState } from 'react';
import { resolveAssetUrl } from '../services/api';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);
const MODEL_EXTENSIONS = new Set(['.stl', '.glb', '.gltf']);

function fileExtension(value) {
  const clean = String(value || '').toLowerCase().split('?')[0].split('#')[0];
  const index = clean.lastIndexOf('.');
  return index >= 0 ? clean.slice(index) : '';
}

function Model3DThumbnail({
  url,
  alt = 'Preview do modelo 3D',
  className = 'aspect-square',
  fallbackLabel = '3D',
}) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const src = resolveAssetUrl(String(url || '').trim()) || String(url || '').trim();
  const ext = fileExtension(src);
  const isImage = IMAGE_EXTENSIONS.has(ext);
  const isModel = MODEL_EXTENSIONS.has(ext);

  useEffect(() => {
    setFailed(false);
    if (!src || !mountRef.current || !isModel || isImage) return undefined;

    let disposed = false;
    let cleanup = null;

    const setup = async () => {
      try {
        const THREE = await import('three');
        const [{ GLTFLoader }, { STLLoader }] = await Promise.all([
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/loaders/STLLoader.js'),
        ]);
        if (disposed || !mountRef.current) return;

        const container = mountRef.current;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#f8fafc');

        const camera = new THREE.PerspectiveCamera(38, container.clientWidth / Math.max(container.clientHeight, 1), 0.1, 2000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight('#ffffff', 0.95));
        const key = new THREE.DirectionalLight('#ffffff', 1.1);
        key.position.set(2, 4, 5);
        const fill = new THREE.DirectionalLight('#ffffff', 0.45);
        fill.position.set(-3, 1, 4);
        scene.add(key, fill);

        const renderObject = (object) => {
          const group = new THREE.Group();
          group.add(object);
          scene.add(group);

          const box = new THREE.Box3().setFromObject(group);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          group.position.sub(center);
          group.rotation.x = -0.35;
          group.rotation.y = 0.55;

          const maxDim = Math.max(size.x || 1, size.y || 1, size.z || 1);
          const distance = maxDim * 2.2;
          camera.position.set(distance, distance * 0.65, distance);
          camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
        };

        if (ext === '.stl') {
          new STLLoader().load(
            src,
            (geometry) => {
              if (disposed) return;
              geometry.computeVertexNormals();
              const material = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.38, metalness: 0.08 });
              renderObject(new THREE.Mesh(geometry, material));
            },
            undefined,
            () => setFailed(true)
          );
        } else {
          new GLTFLoader().load(
            src,
            (gltf) => {
              if (disposed) return;
              renderObject(gltf.scene);
            },
            undefined,
            () => setFailed(true)
          );
        }

        const handleResize = () => {
          if (!container || !renderer || !camera) return;
          const width = container.clientWidth;
          const height = Math.max(container.clientHeight, 1);
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        };
        const observer = new ResizeObserver(handleResize);
        observer.observe(container);

        cleanup = () => {
          observer.disconnect();
          renderer.dispose();
          renderer.forceContextLoss();
          if (renderer.domElement && renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement);
          }
        };
      } catch {
        setFailed(true);
      }
    };

    setup();

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [src, ext, isImage, isModel]);

  if (isImage && src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`rounded-lg border border-slate-200 object-cover ${className}`.trim()}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 ${className}`.trim()}>
      <div ref={mountRef} className="h-full w-full" />
      {failed || !isModel || !src ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-[10px] font-medium text-slate-500">
          {fallbackLabel}
        </div>
      ) : null}
    </div>
  );
}

export default Model3DThumbnail;
