// Nested.vue
<style scoped>
  div {
    border: 2px solid green;
    margin: 50px;
    padding: 20px;
    width: 200px;
  }

  .red {
    color: green; // this should be overrided by rules in Hello.vue
  }
</style>

<template>
  <div>
    <p>This is the nested component</p>
    <hello></hello>
  </div>
</template>

<script>
import Hello from './Hello.vue'

export default {
	components: {
		'Hello': Hello,
	}
};
</script>