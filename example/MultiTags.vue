// Hello.vue
<style scoped>
	.red {
		color: #f00;
	}
</style>
<style src="./blue.css" scoped></style>

<template>
	<div>
		<h2 class="red">Red [from inline css]</h1>
		<h2 class="blue">Blue [from external css]</h1>
		<h1>{{msg}}</h1>
	</div>
</template>

<script>
export default {
	data () {
		return {
			msg: 'Hello from inline javascript!'
		}
	},
}
</script>

<!-- Only one <script> will have effect, the latter overrides the prior. -->
<script src='MultiTags.js'></script>
