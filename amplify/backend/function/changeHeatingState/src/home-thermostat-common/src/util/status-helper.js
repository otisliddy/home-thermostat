const statusHelper = {};

statusHelper.createStatus = (mode, options) => {
    const status = { mode: mode.val };
    status.since = new Date().getTime();

    if (options && options.duration) {
        const until = new Date(status.since);
        until.setSeconds(until.getSeconds() + options.duration);
        status.until = until.getTime();
    }

    if (options && options.temp) {
        status.temp = options.temp;
    }

    return status;
}

module.exports = statusHelper;
