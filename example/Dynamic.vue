// Dynamic.vue
<style scoped>
  .blue {
    color: blue;
  }
</style>

<template>
  <h1 class="blue">{{msg}}</h1>
</template>

<script>
export default {
  data () {
    return {
      msg: 'I am dynamically imported!'
    }
  },
}
</script>