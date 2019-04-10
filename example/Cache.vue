// Hello.vue
<style scoped>
  .red {
    color: #f00;
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
      msg: 'Cache'
    }
  },
}
</script>
