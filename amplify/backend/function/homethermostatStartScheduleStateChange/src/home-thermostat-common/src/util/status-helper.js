const statusHelper = {};

/*
* status: {mode, since, until, temp, schedule, executionArn}
*/
statusHelper.createStatus = (mode, options, since = new Date()) => {
    const status = { mode: mode };
    status.since = since.getTime();

    if (options && options.duration) {
        const until = new Date(status.since);
        until.setSeconds(until.getSeconds() + options.duration);
        status.until = until.getTime();
    }

    if (options && options.temp) {
        status.temp = options.temp;
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
        if (nextStatus.mode === startingStatus.mode &&
            nextStatus.temp === startingStatus.temp &&
            nextStatus.schedule === startingStatus.schedule) {
                startingStatus.since = nextStatus.since;
        } else if (nextStatus.mode !== startingStatus.mode ||
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
