import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installKaplaygroundWebMCPLifecycle } from "../src/integrations/webmcp/webMCPLifecycle.ts";

class FakeTarget {
    hidden = false;
    listeners = new Map();

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
    }

    removeEventListener(type, listener) {
        this.listeners.get(type)?.delete(listener);
    }

    dispatch(type) {
        for (const listener of this.listeners.get(type) ?? []) {
            if (typeof listener === "function") listener({ type });
            else listener.handleEvent({ type });
        }
    }
}

describe("WebMCP document lifecycle", () => {
    it("aborts old registrations and registers once after page restoration", () => {
        const windowTarget = new FakeTarget();
        const documentTarget = new FakeTarget();
        const scheduled = [];
        const contexts = [{ id: 1 }, { id: 2 }];
        let context = contexts[0];
        const registrations = [];
        const cleanup = installKaplaygroundWebMCPLifecycle(
            () => {
                const registration = { context, stopped: false };
                registrations.push(registration);
                return () => {
                    registration.stopped = true;
                };
            },
            {
                getModelContext: () => context,
                windowTarget,
                documentTarget,
                schedule: callback => scheduled.push(callback),
            },
        );

        assert.equal(registrations.length, 1);
        windowTarget.dispatch("pageshow");
        scheduled.shift()();
        assert.equal(registrations.length, 1, "initial pageshow duplicated tools");

        windowTarget.dispatch("pagehide");
        assert.equal(registrations[0].stopped, true);
        context = contexts[1];
        windowTarget.dispatch("pageshow");
        scheduled.shift()();
        assert.equal(registrations.length, 2);
        assert.equal(registrations[1].context, contexts[1]);

        cleanup();
        assert.equal(registrations[1].stopped, true);
    });

    it("replaces registrations when modelContext changes on focus", () => {
        const windowTarget = new FakeTarget();
        const documentTarget = new FakeTarget();
        let context = { id: 1 };
        const registrations = [];
        const cleanup = installKaplaygroundWebMCPLifecycle(
            () => {
                const registration = { context, stopped: false };
                registrations.push(registration);
                return () => {
                    registration.stopped = true;
                };
            },
            {
                getModelContext: () => context,
                windowTarget,
                documentTarget,
                schedule: callback => callback(),
            },
        );

        context = { id: 2 };
        windowTarget.dispatch("focus");
        assert.equal(registrations.length, 2);
        assert.equal(registrations[0].stopped, true);
        cleanup();
    });

    it("does not re-register while the same context remains active", () => {
        const windowTarget = new FakeTarget();
        const documentTarget = new FakeTarget();
        const context = { id: 1 };
        let count = 0;
        const cleanup = installKaplaygroundWebMCPLifecycle(
            () => {
                count += 1;
                return () => {};
            },
            {
                getModelContext: () => context,
                windowTarget,
                documentTarget,
                schedule: callback => callback(),
            },
        );

        windowTarget.dispatch("focus");
        documentTarget.dispatch("visibilitychange");
        assert.equal(count, 1);
        cleanup();
    });
});
