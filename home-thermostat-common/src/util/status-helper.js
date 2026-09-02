const { modes } = require('../constants/modes');
const { endReasonLabels } = require('../constants/end-reasons');

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

    if (options && options.endReason) {
        status.endReason = options.endReason;
    }

    if (options && options.endTemperature !== undefined && options.endTemperature !== null) {
        status.endTemperature = options.endTemperature;
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
        if (Object.prototype.hasOwnProperty.call(dynamoItem, key) && key !== 'expireAt') {
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

/*
* Statuses are ordered newest first, so the following status sits at a lower index.
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

    // Priority 1: Use next status's start time (handles early turn-off)
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

/*
* A scheduled activity is left open-ended on purpose when it runs to a temperature target rather
* than for a fixed duration, so 'no until' cannot by itself mean 'still running'. If the execution
* behind it is aborted or fails, nothing ever writes the until and the activity would otherwise be
* drawn as running forever. A recorded Off for the device after it started ends it.
*
* deviceStatuses must be the statuses of the activity's own device.
*/
statusHelper.isScheduledActivityRunning = (activity, deviceStatuses = [], currentTime = Date.now()) => {
    const nowSeconds = Math.floor(currentTime / 1000);

    if (activity.since > nowSeconds) {
        return true;
    }

    if (activity.until) {
        return activity.until > nowSeconds;
    }

    return !deviceStatuses.some((status) => status.mode === modes.OFF.val && status.since >= activity.since);
}

// Takes the Off status that closed the run, not the On status that started it.
statusHelper.describeRunEnd = (endingStatus) => {
    if (!endingStatus || !endingStatus.endReason) {
        return null;
    }

    const label = endReasonLabels[endingStatus.endReason] || endingStatus.endReason;

    if (endingStatus.endTemperature === undefined || endingStatus.endTemperature === null) {
        return label;
    }

    return `${label} at ${Number(endingStatus.endTemperature).toFixed(1)}°C`;
}

module.exports = statusHelper;
