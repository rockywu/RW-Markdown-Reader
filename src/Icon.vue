<script setup lang="ts">
import { icons, type IconName } from "./icons";

defineProps<{ name: IconName }>();
</script>

<template>
  <svg
    class="icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    v-html="icons[name]"
  ></svg>
</template>
