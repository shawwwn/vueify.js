// Hello.vue
<style scoped>
  .red {
    color: red;
  }
</style>

<style src="./blue.css" scoped></style>

<template>
  <h1 class="red">{{msg}}</h1>
</template>

<script>
export default {
  data () {
    return {
      msg: 'Hello world!'
    }
  },
}
</script>