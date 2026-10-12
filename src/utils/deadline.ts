/** Bound one asynchronous check by an existing deadline, without cancelling its underlying work. */
export async function withinDeadline<T>(check: () => Promise<T>, deadline: number, expiredValue: T): Promise<T> {
    if (!Number.isFinite(deadline)) return check();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const expired = new Promise<T>(resolve => {
            timer = setTimeout(() => resolve(expiredValue), Math.max(0, deadline - Date.now()));
        });
        // A late rejection is handled by the race even after the deadline wins.
        return await Promise.race([check(), expired]);
    } finally {
        clearTimeout(timer);
    }
}
