/**
 * base64字符串转Uint8Array
 * @param {string} base64String
 * @returns {Uint8Array}
 */
export function base64ToUint8Array(base64String)
{
    let binStr = atob(base64String);
    let length = binStr.length;
    let ret = new Uint8Array(length);
    for (let i = 0; i < length; i++)
        ret[i] = binStr.charCodeAt(i);
    return ret;
}

/**
 * Uint8Array转base64字符串
 * @param {Uint8Array} uint8Array
 * @returns {string}
 */
export function uint8ArrayToBase64(uint8Array)
{
    let length = uint8Array.length;
    let binStr = "";
    for (let i = 0; i < length; i++)
        binStr = binStr + String.fromCharCode(uint8Array[i]);
    let ret = btoa(binStr);
    return ret;
}