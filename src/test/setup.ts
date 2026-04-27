import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Minimal HTMLCanvasElement.getContext stub so jspdf/qrcode can run under jsdom.
// jspdf only uses a tiny subset of the 2D context (mostly text measurement);
// returning a no-op canvas is enough to keep it from crashing during tests.
if (typeof HTMLCanvasElement !== "undefined" && !HTMLCanvasElement.prototype.getContext) {
  // @ts-expect-error - jsdom doesn't implement getContext; we provide a stub.
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return {
      fillRect: () => {},
      clearRect: () => {},
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Array(w * h * 4),
      }),
      putImageData: () => {},
      createImageData: () => [],
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: (text: string) => ({ width: text.length * 6 }),
      fillText: () => {},
      strokeText: () => {},
      transform: () => {},
      rect: () => {},
      clip: () => {},
    };
  };
}

// Some jspdf code paths probe for HTMLCanvasElement.toDataURL.
if (typeof HTMLCanvasElement !== "undefined" && !HTMLCanvasElement.prototype.toDataURL) {
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
}
