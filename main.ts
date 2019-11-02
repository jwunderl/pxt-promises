type PromiseResult<T> = T | PromiseLike<T>;

interface PromiseLike<T> {
    then<TResult1 = T, TResult2 = never>(
        onFulfilled?: (value: T) => PromiseResult<TResult1>,
        onRejected?: (reason: any) => PromiseResult<TResult2>
    ): PromiseLike<TResult1 | TResult2>;
}

class Promise<T> implements PromiseLike<T> {
    public constructor(
        executor: (
            resolve: (value?: T | PromiseLike<T>) => void,
            reject: (reason?: any) => void
        ) => void
    ) {
        // not yet implemented
    }

    public then<TResult1 = T, TResult2 = never>(
        onfulfilled?: (value: T) => PromiseResult<TResult1>,
        onRejected?: (reason: any) => PromiseResult<TResult2>
    ): Promise<TResult1 | TResult2> {
        return undefined; // not yet implemented
    }

    public catch<TResult = never>(
        onRejected?: (reason: any) => PromiseResult<TResult>
    ): Promise<T | TResult> {
        return undefined; // not yet implemented
    }

    public finally(onFinally?: () => void): Promise<T> {
        return undefined; // not yet implemented
    }

    public static all<T>(values: (PromiseResult<T>)[]): Promise<T[]> {
        return undefined; // not yet implemented
    }

    public static allSettled<T>(values: (PromiseResult<T>)[]): Promise<T[]> {
        return undefined; // not yet implemented
    }

    public static race<T>(values: T[]): Promise<T> {
        return undefined; // not yet implemented
    }

    public static reject<T = never>(reason?: any): Promise<T> {
        return undefined; // not yet implemented
    }

    public static resolve<T>(value: PromiseResult<T>): Promise<T> {
        return undefined; // not yet implemented
    }
}