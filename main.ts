type PromiseResult<T> = T | PromiseLike<T>;

interface PromiseLike<T> {
    then<TResult1 = T, TResult2 = never>(
        onFulfilled?: (value: T) => PromiseResult<TResult1>,
        onRejected?: (reason: any) => PromiseResult<TResult2>
    ): PromiseLike<TResult1 | TResult2>;
}

enum PromiseState {
    PENDING,
    FULFILLED,
    REJECTED
}

type Resolver = (
    fulfiller: (value: PromiseResult<T>) => void,
    rejecter: (value: PromiseResult<T>) => void
) => void;

class Promise<T> implements PromiseLike<T> {
    state: PromiseState;
    value: PromiseResult<T>;
    error: any;
    handlers: PromiseLike<any>[];
    public constructor(
        executor: (
            resolve: (value?: T | PromiseLike<T>) => void,
            reject: (reason?: any) => void
        ) => void
    ) {
        this.state = PromiseState.PENDING;
        // not yet implemented
        try {
            
        } catch(e) {

        }
    }

    // protected fulfill(result: PromiseResult<T>): void {
    protected fulfill(result: T): void {
        this.state = PromiseState.FULFILLED;
        this.value = result;
    }

    protected reject(error: any): void {
        this.state = PromiseState.REJECTED;
        this.error = error;
    }

    protected resolve(result: PromiseResult<T>) {
        try {
            // let then = getThen(result);
            // if (then) {
            //     doResolve(then.bind(result), resolve, reject);
            //     return;
            // }
            // fulfill(result)
            if (isThenable(result)) {
                doResolve(
                    (
                        fulfiller: (value: PromiseResult<T>) => void,
                        rejecter: (value: PromiseResult<T>) => void
                    ) => result.then(fulfiller, rejecter),
                    (t: T) => this.resolve(t),
                    (e: any) => this.reject(e)
                );
            }
        } catch (e) {
            this.reject(e);
        }
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

// function getThen<T>(value: PromiseResult<T>) {
//     let t = typeof value;
//     if (value && (t === 'object' || t === 'function')) {
//         let then = (value as PromiseLike<T>).then;
//         if (typeof then === 'function') {
//             return then;
//         }
//     }
//     return null;
// }
function isThenable<T>(value: PromiseResult<T>): value is PromiseLike<T> {
    let t = typeof value;
    if (value && (t === 'object' || t === 'function')) {
        // let then = (value as PromiseLike<T>).then;
        // if (typeof then === 'function') {
        //     return then;
        // }
        return Object.keys(value).indexOf("then") !== -1;
    }
    return false;
}

// function doResolve<T>(
//         fn: Resolver,
//         onFulfilled: (value: PromiseResult<T>) => void,
//         onRejected: (reason: any) => void
//     ) {
//     let done = false;
//     try {
//         fn(function (value) {
//             if (done) return;
//             done = true;
//             onFulfilled(value);
//         }, function (reason) {
//             if (done) return;
//             done = true;
//             onRejected(reason);
//         })
//     } catch (ex) {
//         if (done) return;
//         done = true;
//         onRejected(ex);
//     }
// }
function doResolve<T>(
        fn: Resolver,
        onFulfilled: (value: PromiseResult<T>) => void,
        onRejected: (reason: any) => void
    ) {
    let done = false;
    try {
        fn(function (value) {
            if (done) return;
            done = true;
            onFulfilled(value);
        }, function (reason) {
            if (done) return;
            done = true;
            onRejected(reason);
        })
    } catch (ex) {
        if (done) return;
        done = true;
        onRejected(ex);
    }
}