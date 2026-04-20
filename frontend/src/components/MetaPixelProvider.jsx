import { useEffect } from 'react';
import { fetchPublicMetaPixelConfig } from '../services/api';
import { configureMetaPixel } from '../services/metaPixelService';

function MetaPixelProvider({ children }) {
  useEffect(() => {
    let active = true;
    fetchPublicMetaPixelConfig()
      .then((config) => {
        if (!active) return;
        return configureMetaPixel(config || {});
      })
      .catch(() => {
        if (!active) return;
        configureMetaPixel({ enabled: false });
      });
    return () => {
      active = false;
    };
  }, []);

  return children;
}

export default MetaPixelProvider;
