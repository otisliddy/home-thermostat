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
                status[key] = parseInt(dynamoItem[key]['N']);
            } else {
                status[key] = dynamoItem[key]['S'];
            }
        }
    }
    return status;
}

module.exports = statusHelper;
