// TARGET_REACHED is emitted by the temperature stream lambda; renaming it breaks that contract.
const endReasons = {
    TARGET_REACHED: 'target_temperature_reached',
    TIMED_OUT: 'timed_out',
    DURATION_ELAPSED: 'duration_elapsed',
    STOPPED_MANUALLY: 'stopped_manually',
};

const endReasonLabels = {
    [endReasons.TARGET_REACHED]: 'reached target',
    [endReasons.TIMED_OUT]: 'timed out',
    [endReasons.DURATION_ELAPSED]: 'ran its duration',
    [endReasons.STOPPED_MANUALLY]: 'stopped manually',
};

module.exports = { endReasons, endReasonLabels };
