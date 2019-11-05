const delay = (n: number) => new Promise(resolve => (pause(n), resolve()));

// catch / then / catch / finally
function test1() {
    const anything = () => {
        throw 'I can be anything because I should never get called!';
    };
    const throwSomethingWrong = () => {
        console.log('not ignored!');
        throw 'Something went wrong...';
    };

    const p = Promise.reject(42)
        .catch(value => value) // resolves
        .catch(anything) // ignored
        .catch(anything) // ignored
        .then(value => console.log(value)) // logs 42
        .then(throwSomethingWrong) // logs not ignored!
        .catch(throwSomethingWrong) // logs not ignored!
        .catch(() => 24) // resolves
        .finally(() => console.log("Heyo!"));
}

// all / allSettled / race
function test2() {
    const promises = [
        delay(100).then(() => 1),
        delay(200).then(() => 2),
        delay(300).then(() => { throw "Boom"; }),
    ];

    Promise.all(promises).then(console.log).catch(console.error);
    Promise.race(promises).then(console.log).catch(console.error);
    //  it looks like allSettled will likely be useless for now due to the need to type it aggressively / with any like below
    Promise.allSettled(promises)
        .then(res => res.filter(p => p.status === "fulfilled") as { status: "fulfilled"; value: number; }[])
        .then(res => res.map(p => p.value))
        .then(console.log)
}

/** really poor random background color chooser **/
function test3() {
    const promises = [];
    for (let i = 0x1; i < 0xF; ++i) {
        const j = i;
        promises.push(
            delay(Math.randomRange(1000, 2000))
                .then(() => j)
        );
    }

    Promise.race(promises)
        .then(c => scene.setBackgroundColor(c));
}

test3()