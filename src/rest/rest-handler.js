function thingSpeak(url, callback) {
    fetchRetry(url, callback, 60);
}

function fetchRetry(url, callback, maxRetries) {
    return new Promise(function (resolve, reject) {
        fetch(url).then(res => res.json()).then(async (data) => {
            if (data !== 0) {
                callback(data);
                resolve(data);
            } else {
                if (maxRetries === 1) return reject('Max retries reached');
                await sleep(1000);
                fetchRetry(url, callback, maxRetries - 1);
            }
        }).catch(function (error) {
            reject(error)
        })
    });
}

function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export default thingSpeak;
