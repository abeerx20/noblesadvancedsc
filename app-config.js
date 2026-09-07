const localFrontendPorts = new Set(["5500", "5501"]);

export const APP_CONFIG = Object.freeze({
  apiBaseUrl: localFrontendPorts.has(window.location.port)
    ? "http://localhost:3000/api/v1"
    : "/api/v1"
});

