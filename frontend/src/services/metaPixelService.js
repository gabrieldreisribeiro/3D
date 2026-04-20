const DEFAULT_CURRENCY = 'BRL';
const SCRIPT_ID = 'meta-pixel-script';

const state = {
  configured: false,
  enabled: false,
  pixelId: null,
  options: {
    auto_page_view: true,
    track_product_events: true,
    track_cart_events: true,
    track_whatsapp_as_lead: true,
    track_order_created: true,
  },
  queue: [],
  scriptPromise: null,
  initializedPixelId: null,
};

function normalizePixelId(value) {
  const pixelId = String(value || '').trim();
  return /^\d{8,32}$/.test(pixelId) ? pixelId : null;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getWindowObject() {
  if (typeof window === 'undefined') return null;
  return window;
}

function ensureBaseScript() {
  const win = getWindowObject();
  if (!win) return Promise.resolve(false);
  if (state.scriptPromise) return state.scriptPromise;

  state.scriptPromise = new Promise((resolve) => {
    if (win.fbq && win.fbq.callMethod) {
      resolve(true);
      return;
    }

    if (!win.fbq) {
      const fbqStub = function fbqStub(...args) {
        if (fbqStub.callMethod) {
          fbqStub.callMethod.apply(fbqStub, args);
        } else {
          fbqStub.queue.push(args);
        }
      };
      fbqStub.queue = [];
      fbqStub.loaded = true;
      fbqStub.version = '2.0';
      win.fbq = fbqStub;
      win._fbq = fbqStub;
    }

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return state.scriptPromise;
}

function trackNow(eventName, payload = {}) {
  const win = getWindowObject();
  if (!win?.fbq || !state.enabled || !state.pixelId) return;
  win.fbq('track', eventName, payload);
}

function flushQueue() {
  if (!state.enabled || !state.pixelId) {
    state.queue = [];
    return;
  }
  if (!state.queue.length) return;
  const pending = [...state.queue];
  state.queue = [];
  pending.forEach((entry) => trackNow(entry.eventName, entry.payload));
}

function queueTrack(eventName, payload = {}) {
  if (!state.enabled || !state.pixelId) return;
  state.queue.push({ eventName, payload });
  flushQueue();
}

function normalizeMetaOptions(config = {}) {
  return {
    auto_page_view: Boolean(config?.auto_page_view ?? true),
    track_product_events: Boolean(config?.track_product_events ?? true),
    track_cart_events: Boolean(config?.track_cart_events ?? true),
    track_whatsapp_as_lead: Boolean(config?.track_whatsapp_as_lead ?? true),
    track_order_created: Boolean(config?.track_order_created ?? true),
  };
}

export async function configureMetaPixel(config = {}) {
  state.configured = true;
  state.options = normalizeMetaOptions(config);
  state.pixelId = normalizePixelId(config?.pixel_id);
  state.enabled = Boolean(config?.enabled) && Boolean(state.pixelId);

  if (!state.enabled || !state.pixelId) {
    state.queue = [];
    return { enabled: false };
  }

  const loaded = await ensureBaseScript();
  if (!loaded) {
    return { enabled: false };
  }

  const win = getWindowObject();
  if (!win?.fbq) {
    return { enabled: false };
  }

  if (state.initializedPixelId !== state.pixelId) {
    win.fbq('init', state.pixelId);
    state.initializedPixelId = state.pixelId;
  }

  flushQueue();
  return { enabled: true, pixel_id: state.pixelId };
}

function createEventPayload(payload = {}) {
  const metadata = payload?.metadata_json || {};
  const quantity = Math.max(1, Math.floor(toNumber(metadata.quantity ?? metadata.num_items ?? metadata.items_count ?? 1, 1)));
  const contentIdFromPayload = payload?.product_id != null ? String(payload.product_id) : null;
  const contentIds = Array.isArray(metadata.content_ids)
    ? metadata.content_ids.map((item) => String(item)).filter(Boolean)
    : [metadata.slug ? String(metadata.slug) : contentIdFromPayload].filter(Boolean);
  const value = toNumber(
    metadata.value ?? metadata.total ?? metadata.unit_price ?? metadata.line_total ?? metadata.estimated_value ?? 0,
    0
  );
  const contentName = metadata.content_name || metadata.title || metadata.product_title || metadata.slug || undefined;

  return {
    content_name: contentName,
    content_ids: contentIds,
    content_type: metadata.content_type || 'product',
    value,
    currency: metadata.currency || DEFAULT_CURRENCY,
    num_items: Math.max(1, Math.floor(toNumber(metadata.num_items ?? metadata.items_count ?? metadata.quantity ?? quantity, quantity))),
  };
}

export function trackMetaPixelFromInternalEvent(payload = {}) {
  if (!state.configured || !state.enabled) return;
  const eventType = String(payload?.event_type || '').trim();
  if (!eventType) return;

  const eventPayload = createEventPayload(payload);

  if (eventType === 'page_view' && state.options.auto_page_view) {
    queueTrack('PageView');
    return;
  }

  if (eventType === 'product_view' && state.options.track_product_events) {
    queueTrack('ViewContent', {
      content_name: eventPayload.content_name,
      content_ids: eventPayload.content_ids,
      content_type: eventPayload.content_type,
      value: eventPayload.value,
      currency: eventPayload.currency,
    });
    return;
  }

  if (eventType === 'add_to_cart' && state.options.track_cart_events) {
    queueTrack('AddToCart', {
      content_name: eventPayload.content_name,
      content_ids: eventPayload.content_ids,
      value: eventPayload.value,
      currency: eventPayload.currency,
    });
    return;
  }

  if (eventType === 'start_checkout' && state.options.track_cart_events) {
    queueTrack('InitiateCheckout', {
      num_items: eventPayload.num_items,
      value: eventPayload.value,
      currency: eventPayload.currency,
    });
    return;
  }

  if (eventType === 'whatsapp_click' && state.options.track_whatsapp_as_lead) {
    queueTrack('Lead', {
      content_name: eventPayload.content_name,
      value: eventPayload.value,
      currency: eventPayload.currency,
    });
    return;
  }

  if (eventType === 'order_created' && state.options.track_order_created) {
    queueTrack('Purchase', {
      value: eventPayload.value,
      currency: eventPayload.currency,
      content_ids: eventPayload.content_ids,
      num_items: eventPayload.num_items,
    });
  }
}

export function getMetaPixelRuntimeStatus() {
  return {
    configured: state.configured,
    enabled: state.enabled,
    pixel_id: state.pixelId,
    options: { ...state.options },
  };
}
