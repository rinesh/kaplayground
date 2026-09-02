import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { registerKaplaygroundWebMCP } from "./integrations/webmcp/kaplaygroundWebMCP";
import { installKaplaygroundWebMCPLifecycle } from "./integrations/webmcp/webMCPLifecycle";

const stopKaplaygroundWebMCP = installKaplaygroundWebMCPLifecycle(
    registerKaplaygroundWebMCP,
);

if (import.meta.hot) {
    import.meta.hot.dispose(stopKaplaygroundWebMCP);
}

createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>,
);
