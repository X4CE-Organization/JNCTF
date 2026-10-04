<script setup lang="ts">
import { NResult, NButton } from 'naive-ui';
import { useRouter } from 'vue-router';
const router = useRouter();
</script>

<template>
  <n-result status="404" title="页面不存在" description="链接可能已经失效，或者你没有访问权限">
    <template #footer>
      <n-button type="primary" @click="router.push('/')">回到首页</n-button>
    </template>
  </n-result>
</template>
