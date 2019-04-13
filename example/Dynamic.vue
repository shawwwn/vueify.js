// Dynamic.vue
<style scoped>
  .orange {
    color: orange;
  }
  .teal {
    color: teal;
  }
</style>

<template>
  <h1 :class="color">{{msg}}</h1>
</template>

<script>
export default {
  props: ['msg', 'color'],
  data () {
    return {};
  },
}
</script>