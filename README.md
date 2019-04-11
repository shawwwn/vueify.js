# Vueify.js

Browser loading .vue file from script tag. No muss, no fuss!

<img src="https://user-images.githubusercontent.com/4016736/55936265-a29a3200-5bea-11e9-90a7-46bbd762c0c2.png" width="200" height="230" />

## Description:
___Tl;dr.___ `Vueify.js` is an attempt to recreate the desired behavior of [Vueify](https://github.com/vuejs/vueify) in browser environment!

> Vue's [Single-File-Compoment(SFC)](https://vuejs.org/v2/guide/single-file-components.html) is a nice feature allowing modular code and easier code refactorization. However, a SFC **(*.vue)** file needs to be locally compiled into into browser recognizable primitives(js, css, etc.) before shipping to your browser. This process is not at all straight-forward. At the minimium you will need:
>
>    npm --> browserify --> vueify --> watchify(if you want realtime transpiling) --> bundle.js
>
> With more sophisticated web pre-processing suites(glup, babel, webpack, rollup etc), the initial setup time of your project would easily overwhelm the actual development.
>
> For developers who want to take advantage of the **.vue** file but would prefer to keep a light stacks, I present you `Vueify.js` -- Works just like [Vueify](https://github.com/vuejs/vueify), except gets everything done in the browser. No more local preprocessors, develop frontend app in a truly frontend environment.


## Usage:
**First include script tags linked to .vue files, then include vueify.js**

Set `type='vue'` for our script tags, because browser won't automatically load content in script tags with unknown type.
 
```html
<script src="Hello.vue" type='vue'></script>
<script src="vueify.js"></script>
```

SFC loaded this way will be registered globally under the its SFC file name or the name user specified in script tag.
  
```html
<script src="Hello.vue" type='vue' name='custom-name'></script>
```


## How It Works:
`vueify.js` will first scan document for script tags with `type=vue`, gather url for .vue files.

It then downloads and transpiles these .vue files and their dependent .vue files(from `import`) into ES6-compatible javascript.

We refer to .vue files inside script tags as root-level therefore they will be automatically loaded as global Vue components by `vueify.js`. Users are responsible for registering any children Vue component inside these .vue files.


## Example:
Write your Vue component like this:
```html
// Hello.vue
<style>
  .red {
    color: #f00;
  }
</style>

<template>
  <h1 class="red">{{msg}}</h1>
</template>

<script>
export default {
  data () {
    return {
      msg: 'Hello world!'
    }
  }
}
</script>
```

Then write your html like this:
```html
<!DOCTYPE html>
<html>
<body>
  <div id="components-demo">
    <Hello></Hello>
  </div>
  
  <script src="https://vuejs.org/js/vue.js"></script>
  <script src="Hello.vue" type='vue'></script>
  <script src="vueify.js"></script>
  <script type="text/javascript">
    var app = new Vue({ 
       el: '#components-demo'
    });
  </script>
</body>
</html>
```


## Note: 
* Please verify that `vueify.js` loads after `vue.js` and `*.vue`.
* No custom lang support ~~lang="coffee"~~ in .vue.
* Use ES6's `import/export` for nested components, CommonJS's `require/module.exports` is not currently supported.
* Cyclic dependency in .vue file will cause transpile error.
* Refer TODOs in source code for future improvements.
* Contributions are always welcome! Just submit a PR ;)
