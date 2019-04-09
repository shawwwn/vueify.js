# Vueify.js
Browser loading .vue file from script tag. No muss, no fuss!


## Description:
Vue's [Single-File-Compoment(SFC)](https://vuejs.org/v2/guide/single-file-components.html) is a nice feature allowing modular code and easier code refactorization. However, a SFC **(*.vue)** file needs to be locally compiled into into browser recognizable primitives(js, css, etc.) before shipping to your browser. This process is not at all straight-forward. At the minimium you will need:
    
    npm --> browserify --> vueify --> watchify(if you want realtime transpiling) --> bundle.js

With more sophisticated web pre-processing suites(glup, babel, webpack, rollup etc), the initial setup time of your project would easily overwhelm the actual development.

For developers who want to take advantage of the **.vue** file but would prefer the old ways of front-end development, I present you `Vueify.js` -- Works just like [Vueify](https://github.com/vuejs/vueify), but gets everything done in the browser. No more local preprocessors, no more BS!


## Usage:
First include script tag for .vue files, then include vueify.js
Set `type='vue'` on script tags for .vue files, because browser won't load scripts with unknown type by default.
 
```html
<script src="Hello.vue" type='vue'></script>
<script src="vueify.js"></script>
```

Vue' SFC loaded this way will be registered globally under the its SFC file name or the name user specified in script tag.
  
```html
<script src="Hello.vue" type='vue' name='custom-name'></script>
```


## How It Works:
`vueify.js` first scans all script tags with `type=vue`, then loads .vue files from remote server and compiles their contents into corresponding css/js to be dynamically injected to web page. 


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
* Refer TODOs in source code for future improvements.
* Contributions are welcome! Just submit a PR ;)
