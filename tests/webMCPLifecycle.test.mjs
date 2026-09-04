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

class ManualContextChecks {
    tasks = [];

    schedule = callback => {
        const task = { callback, canceled: false };
        this.tasks.push(task);
        return () => {
            task.canceled = true;
        };
    };

    runNext() {
        const task = this.tasks.shift();
        assert.ok(task, "No context check was scheduled.");
        if (!task.canceled) task.callback();
        return task;
    }
}

describe("WebMCP document lifecycle", () => {
    it("keeps tools registered when beforeunload is canceled", () => {
        const windowTarget = new EventTarget();
        const documentTarget = new EventTarget();
        const context = {};
        let registrations = 0;
        let registered = false;
        const cleanup = installKaplaygroundWebMCPLifecycle(
            () => {
                registrations += 1;
                registered = true;
                return () => {
                    registered = false;
                };
            },
            { windowTarget, documentTarget, getModelContext: () => context },
        );

        try {
            windowTarget.addEventListener("beforeunload", event => {
                event.preventDefault();
            });
            const navigationContinues = windowTarget.dispatchEvent(
                new Event("beforeunload", { cancelable: true }),
            );
            assert.equal(navigationContinues, false);
            assert.equal(registered, true, "canceling navigation must retain tools");
            assert.equal(registrations, 1, "canceling navigation must not replace tools");

            windowTarget.dispatchEvent(new Event("pagehide"));
            assert.equal(registered, false, "leaving the page must still clean up");
        } finally {
            cleanup();
        }
    });

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

    it("detects WebMCP added after an already-open page becomes active", () => {
        const windowTarget = new FakeTarget();
        const documentTarget = new FakeTarget();
        const contextChecks = new ManualContextChecks();
        let context;
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
                scheduleContextCheck: contextChecks.schedule,
            },
        );

        assert.equal(registrations.length, 1);
        assert.equal(registrations[0].context, undefined);
        assert.equal(contextChecks.tasks.length, 1);
        context = { id: 1 };
        contextChecks.runNext();
        assert.equal(registrations.length, 2);
        assert.equal(registrations[0].stopped, true);
        assert.equal(registrations[1].context, context);
        assert.equal(
            contextChecks.tasks.length,
            0,
            "checks must stop after WebMCP becomes available",
        );

        cleanup();
        assert.equal(registrations[1].stopped, true);
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
