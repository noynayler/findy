import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error('Root element with id "root" not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary title="Findy could not load">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
