/**
 * Ordered cleanup on the way out.
 *
 * Anything holding state the process does not own - a remote subscription, an
 * open socket - registers here rather than adding its own process.on, so the
 * teardown order is one list in server.ts instead of a race between modules.
 *
 * Best-effort by design. Windows never raises SIGTERM from the OS, so a
 * ts-node-dev respawn kills the process without any of this running, and SIGKILL
 * or a crash skips it everywhere. Nothing may depend on a hook having run - see
 * the reconcile step in teamsSubscription.service.ts, which is what actually
 * keeps duplicate Graph subscriptions from piling up.
 */

type Hook = () => unknown | Promise<unknown>;

const hooks: { name: string; run: Hook }[] = [];
let shuttingDown = false;

/** Hooks run in registration order, so register the outermost layer first. */
export const onShutdown = (name: string, run: Hook): void => {
    hooks.push({ name, run });
};

const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received - shutting down`);

    // A hook that never settles would otherwise leave the process hanging with
    // no way out but a second Ctrl+C. unref so it cannot hold the loop open by
    // itself once the hooks finish early.
    setTimeout(() => {
        console.error("shutdown timed out after 10s - forcing exit");
        process.exit(1);
    }, 10_000).unref();

    for (const { name, run } of hooks) {
        try {
            await run();
        } catch (error) {
            // One failed hook must not strand the ones after it.
            console.error(`shutdown ${name} FAILED:`, error instanceof Error ? error.message : error);
        }
    }

    process.exit(0);
};

/** Called once, from server.ts, after every hook is registered. */
export const listenForShutdown = (): void => {
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
};
