# jsRCO 项目结构信息

## todo 列表

-   todo
    -   远程共享对象
    -   实现安全接口
    -   完善项目结构信息

## 源码结构

(todo)

## 函数调用协议

使用一个数组 (arr)

数组的第一个元素为一个整数 表示操作类型(type)

之后的数组元素根据操作类型分别定义

-   操作类型
    -   调用命名函数 (type = 0)
        -   函数名称 (arr[1]: string)
        -   函数参数 (arr[2]: Array<any>)
        -   函数参数 中包含的函数对应的 id (arr[3]: Map<Object, string>)
        -   返回时调用的函数 不等待返回结果 (arr[4]?: string)
        -   出错时调用的函数 不等待返回结果 (arr[5]?: string)
    -   调用id函数 (type = 1)
        -   函数 id (arr[1]: string)
        -   函数参数 (arr[2]: Array<any>)
        -   函数参数 中包含的函数对应的 id (arr[3]: Map<Object, string>)
        -   返回时调用的函数 不等待返回结果 (arr[4]?: string)
        -   出错时调用的函数 不等待返回结果 (arr[5]?: string)
    -   释放id函数 (type = 2)
        -   函数 id (arr[1...]: string)
