# awa5js

An implementation of the [AWA5.0](https://github.com/TempTempai/AWA5.0) language.

Unlike the original ([which you should check out](https://github.com/TempTempai/AWA5.0)) 
this interpreter is provided as an ES6 module.

Additionally, there are a few important differences listed later in
this document.

## Install

Since it's an ES6 module you can just take the file and drop it
somewhere, then import it in your scripts according to ES6 rules.

```
<script type="module">
  import AWA5 from './awa5.js';

  // rest of code...
</script>
```

## Usage

To execute some AWA5.0 code you first need to create an instance of the interpreter:

```
const awa5 = new AWA5();
```

Then you create an input reader and an output writer to handle user
submissions and visualize the output generated by the program.
Interfacing with the DOM to build a better user interface is explained
later.

```
const inputStream = [1,2,3];
const reader = AWA5.reader({ buffer: inputStream });

const outputStream = [];
const writer = AWA5.writer({ buffer: outputStream });

awa5.setInputReader(reader).setOutputWriter(writer);
```

You can then execute some code. The interpreter is asynchronous, so
you will have to either use the `await` keyword or handle the promise
with a `.then()`.

```
// this will print 1 to the console
awa5.run('awa awa awawa awa awa').then((e) => { console.log(e); });
```

### Interfacing with the DOM

In the previous code snippets we provided an array with some values as
the input stream. This is rarely possible as usually users provide
some inputs only when prompted to, for example to reply to some
question.

It is possible to suspend execution whenever a read operation is
reached by providing two DOM nodes: one to get input from, the other
to resume the interpreter when activated. In particular the second DOM
node has to response to `click` events, e.g. buttons.

```
const reader = AWA5.reader({
  node: document.getElementById('input'),
  actor: document.getElementById('send'),
});

const writer = AWA5.writer({
  node: document.getElementById('output'),
});

awa5.setInputReader(reader).setOutputWriter(writer);
```

The reader will send two custom events: `awa5:prompt` before
suspending the interpreter; `awa5:processing` when resuming.

Other code can listen to these events to handle the user interface,
for example enabling or disabling a button or removing the contents of
a `<textarea>` element.

```
window.addEventListener('awa5:prompt', function (e) {
  e.detail.node.disabled = false;
  e.detail.actor.disabled = false;
});

window.addEventListener('awa5:processing', function (e) {
  e.detail.node.disabled = true;
  e.detail.actor.disabled = true;
});
```

## Differences with the original specifications

This implementation has a number of important differences that you
might want to keep in mind:

### Arguments are always 8 bits

The original will always read 5 bits worth of awawaws, except for the
`BLO` awawatism that will read 8 bits. This difference is not obvious
and since 8 bits are required for AwaSCII, all arguments are unified
to the largest value.

### There is a new EQZ awawatism

The EQZ awawatism will check if the topmost bubble is zero. It's a
shortcut to `BLO 0 EQL`.

### Comparison awawatisms are now conditional JMP

Originally, all the comparison awawatisms would skip exactly one
operation if the result is `false`; in this implementation these
awawatisms take a label (defined by `LBL`) as argument and will `JMP`
to that label if the result is `true`.

### The interpreter has a fixed execution limit

The interpreter will stop with an error after 10000 (ten thousands)
operations, no matter what.
