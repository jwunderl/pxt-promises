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
    onFulfilled: (value: T) => PromiseResult<TResult1>;
    onRejected: (reason: any) => PromiseResult<TResult2>;
}

class Promise<T> implements PromiseLike<T> {
    protected state: PromiseState;
    protected value: T;
    protected error: any;
    protected handlers: Handler<T, any, any>[];

    /**
     * INTERNAL
     * this is temporarily used to identify Promise class objects at runtime,
     * as Object.keys cannot yet enumerate objects that are dynamically class types.
     * 
     * This may change or be removed at any time.
     **/
    __PROMISE_MARK = 42;

    public constructor(
        executor: (
            resolve: (value?: T | PromiseLike<T>) => void,
            reject: (reason?: any) => void
        ) => void
    ) {
        this.state = PromiseState.PENDING;
        this.handlers = [];

        control.runInParallel(() => {
            doResolve(
                (
                    fulfiller: (value: PromiseResult<T>) => void,
                    rejecter: (value: PromiseResult<T>) => void
                ) => executor(fulfiller, rejecter),
                (t: T) => this.resolveThis(t),
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

    /** typically just .resolve, but renaming to disambiguate between this and Promise.resolve()**/
    protected resolveThis(result: PromiseResult<T>) {
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
                    (t: T) => this.resolveThis(t),
                    (e: any) => this.reject(e)
                );
            } else {
                this.fulfill(result);
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
        control.runInParallel(() => {
            this.handle({
                onFulfilled: onFulfilled || ((t) => { }),
                onRejected: onRejected || ((t) => { })
            });
        });
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
        return this.then(
            value => Promise.resolve(onFinally()).then(() => value),
            reason => Promise.resolve(onFinally()).then(() => { throw reason; })
        );
    }

    public static all<T>(promises: (PromiseLike<T>)[]): Promise<T[]> {
        return new Promise((fulfill, reject) => {
            const result: T[] = [];
            let completed = 0;

            for (let i = 0; i < promises.length; ++i) {
                promises[i].then(value => {
                    result[i] = value;

                    if ((++completed) == promises.length) {
                        fulfill(result);
                    }
                }, reject);
            }
        });
    }

    public static allSettled<T>(promises: PromiseLike<T>[]): Promise<T[]> {
        return undefined; // not yet implemented
    }

    public static race<T>(promises: PromiseLike<T>[]): Promise<T> {
        return new Promise(function (fulfill, reject) {
            promises.forEach(function (p) {
                // invoke the first one that completes, ignore the rest
                p.then(
                    fulfill,
                    reject
                );
            });
        });
    }

    public static reject<T = never>(reason?: any): Promise<T> {
        return new Promise((_, reject) => reject(reason));
    }

    public static resolve<T>(value: PromiseResult<T>): Promise<T> {
        return new Promise(resolve => resolve(value));
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
        return (value as any).__PROMISE_MARK || (Object.keys(value).indexOf("then") !== -1);
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

// TODO: is node8 util.promisify implementable? reasonable approximation should be