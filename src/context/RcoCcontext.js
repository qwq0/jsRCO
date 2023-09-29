import { JSOBin } from "../../lib/jsobin.js";
import { TmpFunctionInfo } from "./TmpFunctionInfo.js";
import { base64ToUint8Array, uint8ArrayToBase64 } from "../util/base64.js";
import { uniqueIdentifierString } from "../util/uniqueIdentifier.js";

let jsobContext = new JSOBin();

/**
 * rco操作上下文
 */
export class RcoCcontext
{
    /**
     * 全局命名函数
     * @type {Map<string, function>}
     */
    #globalNamedFunctionMap = new Map();

    /**
     * 运行中传递的函数
     * (对方持有的本地的函数)
     * @type {Map<string, TmpFunctionInfo>}
     */
    #idFunctionMap = new Map();

    /**
     * 持有的对方的函数
     * @type {Map<string, WeakRef<function>>}
     */
    #holdingFunctionMap = new Map();

    /**
     * 输出流
     * @param {string | Uint8Array | object} data
     * @returns {void}
     */
    #outStream = (data) => { throw "RcoCcontext: not bound to an output stream"; };

    /**
     * 输出流类型
     * 0 raw Object
     * 1 jsobin Uint8array
     * 2 base64(jsobin) string
     * @type {0 | 1 | 2}
     */
    #outStreamType = 1;

    /**
     * 回收持有的目标的函数
     * 当不再持有时通知目标进行释放
     * @type {FinalizationRegistry<string>}
     */
    #holdingFunctionRegistry = null;

    constructor()
    {
        this.#holdingFunctionRegistry = new FinalizationRegistry((id) =>
        {
            this.#holdingFunctionMap.delete(id);
            this.#outputPacket([ // 通知目标释放函数
                2,
                id
            ]);
        });
    }

    /**
     * 输出数据包
     * @param {Object} data
     */
    #outputPacket(data)
    {
        switch (this.#outStreamType)
        {
            case 0:
                this.#outStream(data);
                break;
            case 1:
                this.#outStream(jsobContext.encode(data));
                break;
            case 2:
                this.#outStream(uint8ArrayToBase64(jsobContext.encode(data)));
                break;
        }
    }

    /**
     * 绑定输出流
     * 会覆盖之前绑定的输出流
     * @param {(data: string | Uint8Array | object) => void} onDataCallback 
     * @param { "jsob" | "jsobin" | "base64" | "raw" } [type]
     */
    bindOutStream(onDataCallback, type = "jsob")
    {
        this.#outStream = onDataCallback;

        if (type == "raw")
            this.#outStreamType = 0;
        else if (type == "jsob" || type == "jsobin")
            this.#outStreamType = 1;
        else if (type == "base64")
            this.#outStreamType = 2;
        else
            throw "RcoCcontext(bindOutStream): Unsupported output stream types";
    }

    /**
     * 添加全局命名函数
     * @param {Object<string, function>} functionMapObj 
     */
    addGlobalNamedFunctions(functionMapObj)
    {
        Object.keys(functionMapObj).forEach(functionName =>
        {
            this.#globalNamedFunctionMap.set(functionName, functionMapObj[functionName]);
        });
    }

    /**
     * 收到数据包
     * @param {object} data
     */
    async #onPacket(data)
    {
        if (Array.isArray(data))
        {
            let type = data[0];
            switch (type)
            {
                case 0: { // 调用命名函数
                    let func = this.#globalNamedFunctionMap.get(data[1]); // arr[1] 函数名
                    if (func)
                    {
                        let param = (
                            data[3] ? // arr[3] 函数参数中包含的函数对应的id表
                                this.#injectFunction(data[2], data[3]).result :
                                data[2] // arr[2] 函数的参数
                        );

                        try
                        {
                            let retValue = await func(...param);
                            if (data[4]) // arr[4] 返回时调用的函数 
                            {
                                let result = this.#extractFunction(retValue);
                                this.#outputPacket([
                                    1, // 执行id函数 (resolve函数)
                                    data[4],
                                    [result.result],
                                    (result.fnMap.size > 0 ? result.fnMap : undefined)
                                ]);
                            }
                        }
                        catch (err)
                        {
                            if (data[5]) // arr[5] 出错时调用的函数
                                this.#outputPacket([
                                    1, // 执行id函数 (reject函数)
                                    data[5],
                                    [err]
                                ]);
                        }
                    }
                    else
                    {
                        if (data[5]) // arr[5] 出错时调用的函数
                            this.#outputPacket([
                                1,
                                data[5],
                                ["function does not exist"]
                            ]);
                    }
                    break;
                }
                case 1: { // 调用id函数
                    let id = data[1];
                    let funcInfo = this.#idFunctionMap.get(id); // arr[1] 函数id
                    if (funcInfo)
                    {
                        let param = (
                            data[3] ? // arr[3] 函数参数中包含的函数对应的id表
                                this.#injectFunction(data[2], data[3]).result :
                                data[2] // arr[2] 函数的参数
                        );

                        let func = funcInfo.func;
                        if (funcInfo.once)
                            this.#idFunctionMap.delete(id);
                        if (funcInfo.releaseTarget)
                            this.#idFunctionMap.delete(funcInfo.releaseTarget);

                        try
                        {
                            let retValue = await func(...param);
                            if (data[4]) // arr[4] 返回时调用的函数 
                            {
                                let result = this.#extractFunction(retValue);
                                this.#outputPacket([
                                    1,
                                    data[4],
                                    [result.result],
                                    (result.fnMap.size > 0 ? result.fnMap : undefined)
                                ]);
                            }
                        }
                        catch (err)
                        {
                            if (data[5]) // arr[5] 出错时调用的函数
                                this.#outputPacket([
                                    1,
                                    data[5],
                                    [err]
                                ]);
                        }
                    }
                    else
                    {
                        if (data[5]) // arr[5] 出错时调用的函数
                            this.#outputPacket([
                                1,
                                data[5],
                                ["function does not exist"]
                            ]);
                    }
                    break;
                }
                case 2: { // 释放id函数
                    data.slice(1).forEach(id =>
                    {
                        this.#idFunctionMap.delete(id);
                    });
                    break;
                }
                default:
            }
        }
    }

    /**
     * 输入流收到数据应调用
     * @param {string | Uint8Array | object} data 
     */
    onData(data)
    {
        if (typeof (data) == "string")
            this.#onPacket(jsobContext.decode(base64ToUint8Array(data)));
        else if (data instanceof Uint8Array)
            this.#onPacket(jsobContext.decode(data));
        else if (typeof (data) == "object")
            this.#onPacket(data);
        else
            throw "RcoCcontext(onData): Unable to process this data type";
    }

    /**
     * 调用命名函数
     * 
     * @async
     * 
     * @param {string} name
     * @param {Array<any>} param
     */
    callNamedFunction(name, ...param)
    {
        return new Promise((resolve, reject) =>
        {
            let result = this.#extractFunction(param);
            let resolveId = uniqueIdentifierString();
            let rejectId = uniqueIdentifierString();
            this.#idFunctionMap.set(resolveId, new TmpFunctionInfo(resolve, true, rejectId));
            this.#idFunctionMap.set(rejectId, new TmpFunctionInfo(reject, true, resolveId));
            this.#outputPacket([
                0, // 执行命名函数
                name,
                result.result,
                (result.fnMap.size > 0 ? result.fnMap : undefined),
                resolveId,
                rejectId
            ]);
        });
    }

    /**
     * 获取一个代理对象
     * 以函数名为key 返回的函数用于调用命名函数
     * @returns {Object<string, function>}
     */
    getGlobalNamedFunctionProxy()
    {
        return new Proxy({}, {
            set: () => false,
            get: (_target, /** @type {string} */ key) =>
            {
                return (/** @type {Array<any>} */ ...param) =>
                {
                    return this.callNamedFunction(key, ...param);
                };
            }
        });
    }

    /**
     * 将函数注入回对象
     * @param {Object} obj 
     * @param {Map<Object, string>} fnMap 
     */
    #injectFunction(obj, fnMap)
    {
        /**
         * 函数id 到 生成出的函数 映射
         * @type {Map<string, Function>}
         */
        let generatedFunctionMap = new Map();
        fnMap.forEach((id, _functionObj) =>
        {
            if (!generatedFunctionMap.has(id))
            {
                let generatedFunction = (/** @type {Array<any>} */ ...param) =>
                {
                    return new Promise((resolve, reject) =>
                    {
                        let result = this.#extractFunction(param);
                        let resolveId = uniqueIdentifierString();
                        let rejectId = uniqueIdentifierString();
                        this.#idFunctionMap.set(resolveId, new TmpFunctionInfo(resolve, true, rejectId));
                        this.#idFunctionMap.set(rejectId, new TmpFunctionInfo(reject, true, resolveId));
                        this.#outputPacket([
                            1, // 执行id函数
                            id,
                            result.result,
                            (result.fnMap.size > 0 ? result.fnMap : undefined),
                            resolveId,
                            rejectId
                        ]);
                    });
                };
                generatedFunctionMap.set(id, generatedFunction);

                this.#holdingFunctionMap.set(id, new WeakRef(generatedFunction));
                this.#holdingFunctionRegistry.register(generatedFunction, id);
            }
        });

        /**
         * 遍历对象嵌入函数
         * @param {any} now 
         * @returns {any}
         */
        const traversal = (now) =>
        {
            if (typeof (now) == "object")
            {
                if (fnMap.has(now))
                {
                    return generatedFunctionMap.get(fnMap.get(now));
                }
                else if (Array.isArray(now))
                {
                    return now.map(traversal);
                }
                else
                {
                    let ret = {};
                    Object.keys(now).forEach(key =>
                    {
                        ret[key] = traversal(now[key]);
                    });
                    return ret;
                }
            }
            else
                return now;
        };
        let result = traversal(obj);

        return ({
            result: result
        });
    }

    /**
     * 提取对象中的函数
     * (并生成函数对应表)
     * @param {Object} obj
     */
    #extractFunction(obj)
    {
        let functionMap = new Map();

        /**
         * 遍历对象过滤函数
         * @param {any} now 
         * @returns {any}
         */
        const traversal = (now) =>
        {
            if (typeof (now) == "function")
            {
                let ret = {};
                let functionId = uniqueIdentifierString();
                this.#idFunctionMap.set(functionId, new TmpFunctionInfo(now, false, ""));
                functionMap.set(ret, functionId);
                return ret;
            }
            else if (typeof (now) == "object")
            {
                if (Array.isArray(now))
                {
                    return now.map(traversal);
                }
                else
                {
                    let ret = {};
                    Object.keys(now).forEach(key =>
                    {
                        ret[key] = traversal(now[key]);
                    });
                    return ret;
                }
            }
            else
                return now;
        };
        let result = traversal(obj);

        return ({
            result: result,
            fnMap: functionMap
        });
    }
}