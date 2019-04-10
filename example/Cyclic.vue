// Cyclic.vue
<template>
  <h1>{{msg}}</h1>
</template>

<script>
import A from './Cyclic.vue'

export default {
  data () {
    return {
      msg: 'I should not be displayed!'
    }
  },
}
</script>