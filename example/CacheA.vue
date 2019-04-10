// CacheA.vue
<template>
  <h1>{{msg}}</h1>
</template>

<script>
import B1 from './CacheB.vue'
import B2 from './CacheB.vue'
import B3 from './CacheB.vue'
import B4 from './CacheB.vue'

var result = (B1===B2) && (B1===B3) && (B1===B4) && 
			(B2===B3) && (B2===B4) &&
			(B3===B4);
var msg = `Test Passed: ${result}`

export default {
  data () {
    return {
      msg,
    }
  },
}
</script>
