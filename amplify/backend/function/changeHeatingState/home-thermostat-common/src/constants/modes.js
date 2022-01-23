const modes = {
    PROFILE: { val: 'Daily Profile', ordinal: '-1' },
    FIXED_TEMP: { val: 'Fixed Temp', ordinal: '2' },
    ON: { val: 'On', ordinal: '1' },
    OFF: { val: 'Off', ordinal: '0' },
}

const fromOrdinal = (ordinal) => {
    return modes[Object.keys(modes).find(key => modes[key].ordinal === ordinal)];
}

module.exports = { modes, fromOrdinal };
