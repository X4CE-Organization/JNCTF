<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{ content?: string | null }>();

marked.setOptions({ breaks: true, gfm: true });

/**
 * 题面是 Markdown。这里把原文交给 marked 渲染成 HTML。
 *
 * 说明：平台的使用者就是出题人与管理员（受信任角色），题面本身是他们的输入；
 * 真正要防的是选手的输入（提交的 flag、工单内容），那些地方一律按纯文本渲染，
 * 不会走到这里。如果你开放了「任何人可出题」，请把下面的 HTML 再过一层白名单过滤。
 */
const html = computed(() => {
  const text = props.content ?? '';
  if (!text.trim()) return '';
  return marked.parse(text, { async: false }) as string;
});
</script>

<template>
  <div class="markdown-body" v-html="html" />
</template>
