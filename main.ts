type PromiseResult<T> = T | PromiseLike<T>;

interface PromiseLike<T> {
    then<TResult1 = T, TResult2 = never>(
        onFulfilled?: (value: T) => PromiseResult<TResult1>,
        onRejected?: (reason: any) => PromiseResult<TResult2>
    ): PromiseLike<TResult1 | TResult2>;
}

/**
 * For Promise.allSettled; ideally should be
 * {status: "fulfilled", value: T} | {status: "rejected", reason: any}
 * to better reflect state, but that makes it really,
 * really, really hard to actually use currently -
 * need to explicitly disambiguate,
 * meaning e.g. filtering on status === "fulfilled" isn't trivially enough.
 **/
interface SettledPromise<T> {
    status: "fulfilled" | "rejected",
    value?: T, // iff status == "fulfilled"
    reason?: any // iff status == "rejected"
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
                (t: T) => this.resolvePromise(t),
                (e: any) => this.reject(e)
            );
        });
    }

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

    protected resolvePromise(result: PromiseResult<T>) {
        try {
            if (isThenable(result)) {
                doResolve(
                    (
                        fulfiller: (value: PromiseResult<T>) => void,
                        rejecter: (value: PromiseResult<T>) => void
                    ) => result.then(fulfiller, rejecter),
                    (t: T) => this.resolvePromise(t),
                    (e: any) => this.reject(e)
                );
            } else {
                this.fulfill(result);
            }
        } catch (e) {
            this.reject(e);
        }
    }

    protected handle<TResult1 = T, TResult2 = never>(handler: Handler<T, TResult1, TResult2>): void {
        switch (this.state) {
            case PromiseState.PENDING:
                this.handlers.push(handler);
                return;
            case PromiseState.FULFILLED:
                handler.onFulfilled(this.value);
                return;
            case PromiseState.REJECTED:
                handler.onRejected(this.error);
                return;
        }
    }

    public done<TResult1 = T, TResult2 = never>(
        onFulfilled?: (value: T) => PromiseResult<TResult1>,
        onRejected?: (reason: any) => PromiseResult<TResult2>
    ): void {
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
                    } else { // if no onRejected, TResult2 = previous error reason
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
                 * below is kind of a hilarious requirement for the ts to compile
                 * properly with the typings above:
                 * need to explicitly cast the status in each case to themselves, 
                 * as the type immediately gets widened to string before being passed otherwiseZ and then fails to compile.
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

    public static resolve<T = void>(value?: PromiseResult<T>): Promise<T> {
        return new Promise(resolve => resolve(value));
    }
}

function isThenable<T>(value: PromiseResult<T>): value is PromiseLike<T> {
    return value instanceof Promise;
}

function doResolve<T>(
    fnToResolve: Resolver<T>,
    onFulfilled: (value: PromiseResult<T>) => void,
    onRejected: (reason: any) => void
) {
    let done = false;
    try {
        fnToResolve(
            value => {
                if (done)
                    return;
                done = true;
                onFulfilled(value);
            },
            reason => {
                if (done)
                    return;
                done = true;
                onRejected(reason);
            }
        );
    } catch (ex) {
        if (done)
            return;
        done = true;
        onRejected(ex);
    }
}