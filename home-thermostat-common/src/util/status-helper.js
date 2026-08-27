const statusHelper = {};

/*
* status: {mode, since, until, executionArn}
*/
statusHelper.createStatus = (thingName, mode, options, since = new Date()) => {
    const status = { device: thingName, mode: mode };
    status.since = Math.round(since.getTime() / 1000);

    if (options && options.duration) {
        const until = new Date(since);
        until.setSeconds(until.getSeconds() + options.duration);
        status.until = Math.round(until.getTime() / 1000);
    }

    if (options && options.executionArn) {
        status.executionArn = options.executionArn.replace(/^"/, '').replace(/"$/, '');
    }

    if (options && options.recurring !== undefined) {
        status.recurring = options.recurring;
    }

    if (options && options.dhwTargetTemperature !== undefined) {
        status.dhwTargetTemperature = options.dhwTargetTemperature;
    }

    return status;
}

statusHelper.findStatusesConsideringDuplicates = (items) => {
    if (items.length === 0) {
        return [];
    }
    const statuses = [];

    let runningIndex = 0;
    while (runningIndex < items.length) {
        const { status, indexReached } = statusHelper.findStatusConsideringDuplicates(items, runningIndex);
        runningIndex = indexReached + 1;
        statuses.push(status);
    }
    return statuses;
}

statusHelper.findStatusConsideringDuplicates = (items, startingIndex) => {
    const startingStatus = items[startingIndex];
    if (startingIndex >= items.length-1) {
        return { status: startingStatus, indexReached: items.length-1 };
    }

    for (let i = startingIndex + 1; i < items.length; i++) {
        const nextStatus = items[i];
        if (nextStatus.device === startingStatus.device &&
            nextStatus.mode === startingStatus.mode &&
            nextStatus.temp === startingStatus.temp &&
            nextStatus.schedule === startingStatus.schedule) {
            startingStatus.since = nextStatus.since;
        } else if (nextStatus.device !== startingStatus.device ||
            nextStatus.mode !== startingStatus.mode ||
            nextStatus.temp !== startingStatus.temp ||
            nextStatus.schedule !== startingStatus.schedule) {
            return { status: startingStatus, indexReached: i-1 };
        }
    }
    return { status: startingStatus, indexReached: items.length-1 };
}

statusHelper.dynamoItemToStatus = (dynamoItem) => {
    const status = {};
    for (const key in dynamoItem) {
        if (dynamoItem.hasOwnProperty(key) && key !== 'expireAt') {
            if (dynamoItem[key].N) {
                status[key] = Number(dynamoItem[key]['N']);
            } else if (dynamoItem[key].BOOL !== undefined) {
                status[key] = dynamoItem[key]['BOOL'];
            } else {
                status[key] = dynamoItem[key]['S'];
            }
        }
    }
    return status;
}

/**
 * Find the status that follows the one at the given index, for the same device.
 * Statuses are expected in reverse chronological order (newest first), so the
 * following status sits at a lower index. Statuses of other devices are skipped,
 * otherwise a status would be cut short by unrelated activity on another device.
 *
 * @param {Array} statuses - Statuses, newest first, possibly for several devices
 * @param {number} index - Index of the status to find the successor of
 * @returns {Object|null} The next status for the same device, or null if it is the most recent
 */
statusHelper.findNextStatusForDevice = (statuses, index) => {
    const status = statuses[index];
    for (let i = index - 1; i >= 0; i--) {
        if (statuses[i].device === status.device) {
            return statuses[i];
        }
    }
    return null;
}

/**
 * Calculate the actual end time of a status.
 * Prioritizes the next status's start time over the current status's 'until' field.
 * This handles cases where heating was turned off early.
 *
 * @param {Object} status - Current status object with 'since' and optional 'until'
 * @param {Object|null} nextStatus - Next status in chronological order (or null if most recent)
 * @param {number} currentTime - Current timestamp (default: Date.now())
 * @returns {number} End time in seconds
 */
statusHelper.getActualEndTime = (status, nextStatus, currentTime = Date.now()) => {
    const currentTimeSeconds = Math.floor(currentTime / 1000);

    // Priority 1: Use next status's start time (handles early turn-off), but never
    // run past 'until'; the next status can be much later if no 'off' was recorded.
    if (nextStatus) {
        return status.until ? Math.min(nextStatus.since, status.until) : nextStatus.since;
    }

    // Priority 2: Use until field only if there's no next status
    if (status.until) {
        return status.until;
    }

    // Priority 3: Still running, use current time
    return currentTimeSeconds;
}

module.exports = statusHelper;
