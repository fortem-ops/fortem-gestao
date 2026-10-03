import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// Aviso inofensivo do navegador (ResizeObserver) — não é erro real; impede falso alarme.
window.addEventListener("error", (e) => {
  if (typeof e.message === "string" && e.message.includes("ResizeObserver loop")) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </ErrorBoundary>
);

// Registrar service worker para PWA e Web Push
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("SW registered:", registration.scope);
      })
      .catch((error) => {
        console.log("SW registration failed:", error);
      });
  });
}
