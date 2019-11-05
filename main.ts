// Implementation partially derived from https://www.promisejs.org/implementing/
type PromiseResult<T> = T | PromiseLike<T>;

interface PromiseLike<T> {
    then<TResult1 = T, TResult2 = never>(
        onFulfilled?: (value: T) => PromiseResult<TResult1>,
        onRejected?: (reason: any) => PromiseResult<TResult2>
    ): PromiseLike<TResult1 | TResult2>;
}

/** for Promise.allSettled. Ideally should be
 * {status: "fulfilled", value: T} | {status: "rejected", reason: any}
 * to better reflect state, but that makes it really,
 * really hard to actually use currently.
 **/
interface SettledPromise<T> {
    status: "fulfilled" | "rejected",
    value?: T, // only if status == "fulfilled"
    reason?: any // only if status == "rejected"
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
        this.handlers = undefined;
    }

    protected reject(error: any): void {
        this.state = PromiseState.REJECTED;
        this.error = error;
        this.handlers.forEach(handler => this.handle(handler));
        this.handlers = undefined;
    }

    /** typically just .resolve, but renaming to disambiguate between this and Promise.resolve()**/
    protected resolveThis(result: PromiseResult<T>) {
        try {
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
            if (this.state === PromiseState.FULFILLED) {
                handler.onFulfilled(this.value);
            }
            if (this.state === PromiseState.REJECTED) {
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
            );
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

            promises.forEach((p, i) => {
                p.then(
                    value => {
                        result[i] = value;

                        if ((++completed) == promises.length) {
                            fulfill(result);
                        }
                    },
                    reject
                );
            });
        });
    }

    public static allSettled<T>(promises: PromiseLike<T>[]): Promise<SettledPromise<T>[]> {
        return Promise.all(
            promises.map(
                /**
                 * below is kind of a hilarious requirement for the ts to compile properly with the typings above:
                 * need to explicitly cast the status in each case to themselves, 
                 * as the type immediately gets widened to string otherwise and then fails to compile.
                 **/
                p => p.then(
                    value => ({
                        status: "fulfilled" as "fulfilled",
                        value: value
                    }),
                    error => ({
                        status: "rejected" as "rejected",
                        reason: error
                    })
                )
            )
        );
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

function isThenable<T>(value: PromiseResult<T>): value is PromiseLike<T> {
    return value instanceof Promise;
    // let t = typeof value;
    // if (value && (t === 'object' || t === 'function')) {
    //     return (value as any).__PROMISE_MARK || (Object.keys(value).indexOf("then") !== -1);
    // }
    // return false;
}

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