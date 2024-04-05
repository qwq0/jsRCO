import { RcoContext } from "../src/index.js";

(async () =>
{
    let context1 = new RcoContext();
    let context2 = new RcoContext();

    context1.bindOutStream((data) => { context2.onData(data); });
    context2.bindOutStream((data) => { context1.onData(data); });

    context1.addGlobalNamedFunctions({
        test_0: (a, b, c) =>
        {
            return (a + b) + c;
        },
        test_1: (callback) =>
        {
            callback(123, "test");
        },
        test_2: (callback) =>
        {
            callback((a) =>
            {
                console.log("run test_2", a);
            });
        },
        test_3: async (callback) =>
        {
            console.log("run test_3", await callback());
        },
        console_log: async (a) =>
        {
            console.log(a);
        }
    });

    (async () =>
    {
        let api = context2.getGlobalNamedFunctionProxy();

        console.log("run test_0", await api.test_0(1, 2, "3"));
        await api.test_1((a, b) =>
        {
            console.log("run test_1", a, b);
        });
        await api.test_2((callback) =>
        {
            callback(456);
        });
        await api.test_3(() => 789);

        console.time();
        for (let i = 0; i < 10; i++)
            await api.test_2((callback) =>
            {
                callback(10);
            });
        console.timeEnd();


        await api.console_log(() => { console.log("test"); });
    })();
})();