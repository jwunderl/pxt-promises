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
    .catch(() => 24); // resolves