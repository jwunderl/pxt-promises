// Implementation partially derived from https://www.promisejs.org/implementing/
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

type Resolver<T> = (
    onFulfilled: (value: PromiseResult<T>) => void,
    onRejected: (value: PromiseResult<T>) => void
) => void;

interface Handler<T, TResult1, TResult2> {
    onFulfilled(value: T): PromiseResult<TResult1>,
    onRejected(reason: any): PromiseResult<TResult2>
}

class Promise<T> implements PromiseLike<T> {
    state: PromiseState;
    value: T;
    error: any;
    handlers: Handler<T, any, any>[];

    public constructor(
        executor: (
            resolve: (value?: T | PromiseLike<T>) => void,
            reject: (reason?: any) => void
        ) => void
    ) {
        this.state = PromiseState.PENDING;
        
        // need to spawn new fiber before this
        control.runInParallel(() => {
            doResolve(
                (
                    fulfiller: (value: PromiseResult<T>) => void,
                    rejecter: (value: PromiseResult<T>) => void
                ) => executor(fulfiller, rejecter),
                (t: T) => this.resolve(t),
                (e: any) => this.reject(e)
            );
        });
    }

    // protected fulfill(result: PromiseResult<T>): void {
    protected fulfill(result: T): void {
        this.state = PromiseState.FULFILLED;
        this.value = result;
        this.handlers.forEach(handler => this.handle(handler));
        this.handlers = undefined
    }

    protected reject(error: any): void {
        this.state = PromiseState.REJECTED;
        this.error = error;
        this.handlers.forEach(handler => this.handle(handler));
        this.handlers = undefined
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

    protected handle<TResult1 = T, TResult2 = never>(handler: Handler<T, TResult1, TResult2>) {
        if (this.state === PromiseState.PENDING) {
            this.handlers.push(handler);
        } else {
            if (this.state === PromiseState.FULFILLED
                // && typeof handler.onFulfilled === 'function') {
            ) {
                handler.onFulfilled(this.value);
            }
            if (this.state === PromiseState.REJECTED
                // && typeof handler.onRejected === 'function') {
            ) {
                handler.onRejected(this.error);
            }
        }
    }

    public done<TResult1 = T, TResult2 = never>(
        onFulfilled?: (value: T) => PromiseResult<TResult1>,
        onRejected?: (reason: any) => PromiseResult<TResult2>
    ): void {
        // ensure we are always asynchronous; normally setTimeout(..., 0)
        // control.runInParallel(() => {
        // since the entire thing is wrapped in a new fiber, just pause trivially to yield
        pause(1);
        this.handle({
            onFulfilled: onFulfilled || ((t) => { }),
            onRejected: onRejected || ((t) => { })
        });
        // });
    }

    public then<TResult1 = T, TResult2 = never>(
        onFulfilled?: (value: T) => PromiseResult<TResult1>,
        onRejected?: (reason: any) => PromiseResult<TResult2>
    ): Promise<TResult1 | TResult2> {
        return new Promise<TResult1 | TResult2>((resolve, reject) => {
            return this.done(
                result => {
                    // if (typeof onFulfilled === 'function') {
                    if (onFulfilled) {
                        try {
                            resolve(onFulfilled(result));
                        } catch (ex) {
                            reject(ex);
                        }
                    } else { // if no onFulfilled, TResult1 = T
                        resolve(result as any as TResult1);
                    }
                },
                error => {
                    // if (typeof onRejected === 'function') {
                    if (onRejected) {
                        try {
                            resolve(onRejected(error));
                        } catch (ex) {
                            reject(ex);
                        }
                    } else { // if no onRejected, TResult1 = T
                        reject(error);
                    }
                }
            )
        });
    }

    public catch<TResult = never>(
        onRejected?: (reason: any) => PromiseResult<TResult>
    ): Promise<T | TResult> {
        return this.then(undefined, onRejected);
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
        fn: Resolver<T>,
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