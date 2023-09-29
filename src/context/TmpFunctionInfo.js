/**
 * 传入上下文的函数 被目标暂时holding时 用于储存信息的类
 * 这些对象随时准备被目标调用
 * 
 * 传入上下文的函数 包括 调用目标的函数时传入的函数 被目标调用函数时返回的函数
 * 随目标对函数的释放 同时释放此对象
 */
export class TmpFunctionInfo
{
    /**
     * 单次调用
     * 表示此函数被调用后就会释放
     * 通常用于resolve和reject
     */
    once = false;

    /**
     * 调用后释放目标对象
     * 通常用于一对resolve与reject相互释放
     * 调用本函数后释放此id的函数 但本函数释放时不会自动释放此函数
     */
    releaseTarget = "";

    /**
     * 转入的函数本身
     * @type {function}
     */
    func = null;

    /**
     * @param {Function} func
     * @param {boolean} once
     * @param {string} releaseTarget
     */
    constructor(func, once, releaseTarget)
    {
        this.func = func;
        this.once = once;
        this.releaseTarget = releaseTarget;
    }
}