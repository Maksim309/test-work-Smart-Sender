import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { api, queryClient } from "./api";
import { AuthProvider } from "./auth/AuthProvider";
import { App } from "./App";
import "./styles.css";

async function start() {
  const { worker } = await import("./mocks/browser");

  await worker.start({ onUnhandledRequest: "bypass", quiet: true });

  await api.initialize();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void start().catch((error: unknown) => {
  console.error("Demo API startup failed:", error);

  const container = document.getElementById("root")!;

  container.setAttribute("role", "alert");

  container.className = "feedback";

  container.textContent =
    "Unable to start the demo API. Run npm run dev or npm run preview, enable Service Workers in your browser, turn off ‘Bypass for network’ in DevTools → Application → Service Workers, and reload the page.";
});
