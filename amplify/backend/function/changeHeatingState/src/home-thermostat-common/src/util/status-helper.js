const statusHelper = {};

statusHelper.createStatus = (mode, options) => {
    const status = { mode: mode.val };
    status.since = new Date().getTime();

    if (options && options.duration) {
        const until = new Date(status.since);
        until.setSeconds(until.getSeconds() + options.duration);
        status.until = until.getTime();
    }

    if (options && options.fixedTemp) {
        status.fixedTemp = options.fixedTemp;
    }

    return status;
}

module.exports = statusHelper;
