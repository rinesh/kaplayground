import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { registerKaplaygroundWebMCP } from "./integrations/webmcp/kaplaygroundWebMCP";
import { getStarterDemoUrl } from "./integrations/webmcp/starterDemoUrl";

const starterDemoUrl = getStarterDemoUrl(window.location.href);
if (starterDemoUrl) {
    window.history.replaceState(window.history.state, "", starterDemoUrl);
}

const unregisterKaplaygroundWebMCP = registerKaplaygroundWebMCP();

if (import.meta.hot) {
    import.meta.hot.dispose(unregisterKaplaygroundWebMCP);
}

createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>,
);
