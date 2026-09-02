import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { installGameConsoleCapture } from "./hooks/useGameConsole";
import { registerKaplaygroundWebMCP } from "./integrations/webmcp/kaplaygroundWebMCP";
import { installKaplaygroundWebMCPLifecycle } from "./integrations/webmcp/webMCPLifecycle";

const stopGameConsole = installGameConsoleCapture();
const stopKaplaygroundWebMCP = installKaplaygroundWebMCPLifecycle(
    registerKaplaygroundWebMCP,
);

if (import.meta.hot) {
    import.meta.hot.dispose(stopKaplaygroundWebMCP);
    import.meta.hot.dispose(stopGameConsole);
}

createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>,
);
