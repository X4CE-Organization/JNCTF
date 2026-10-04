<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NTag, NGrid, NGi, NEmpty, NSpin, NButton, NSpace } from 'naive-ui';
import { useRouter } from 'vue-router';
import { api, query } from '../api';

const router = useRouter();
const loading = ref(true);
const items = ref<any[]>([]);
const tab = ref<'all' | 'running' | 'upcoming' | 'ended'>('all');

const STATUS: Record<string, { label: string; type: any }> = {
  UPCOMING: { label: '未开始', type: 'info' },
  RUNNING: { label: '进行中', type: 'success' },
  FROZEN: { label: '封榜中', type: 'warning' },
  ENDED: { label: '已结束', type: 'default' },
};

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>(`/api/competitions${query({ size: 50 })}`);
    items.value = data.items ?? [];
  } finally {
    loading.value = false;
  }
}

function filtered() {
  if (tab.value === 'all') return items.value;
  return items.value.filter((c) => c.status === tab.value.toUpperCase());
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <n-space>
      <n-button v-for="t in [{ k: 'all', l: '全部' }, { k: 'running', l: '进行中' }, { k: 'upcoming', l: '即将开始' }, { k: 'ended', l: '已结束' }]"
        :key="t.k" :type="tab === t.k ? 'primary' : 'default'" size="small" @click="tab = t.k as any">
        {{ t.l }}
      </n-button>
    </n-space>

    <n-spin :show="loading">
      <n-empty v-if="!filtered().length" description="暂无比赛" class="py-16" />
      <n-grid v-else :cols="2" :x-gap="14" :y-gap="14" responsive="screen" item-responsive>
        <n-gi v-for="item in filtered()" :key="item.id" span="2 s:2 m:1">
          <n-card hoverable @click="router.push(`/competitions/${item.slug}`)">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="truncate text-base font-semibold">{{ item.name }}</span>
                  <n-tag size="tiny" :type="STATUS[item.status]?.type">{{ STATUS[item.status]?.label }}</n-tag>
                  <n-tag size="tiny" :bordered="false">
                    {{ { JEOPARDY: '解题', AWD: '攻防', MIXED: '混合' }[item.type as string] }}
                  </n-tag>
                </div>
                <p class="mt-1 line-clamp-2 text-sm opacity-70">{{ item.subtitle || item.description }}</p>
                <div class="mt-2 text-xs opacity-60">
                  {{ new Date(item.startAt).toLocaleString() }} — {{ new Date(item.endAt).toLocaleString() }}
                </div>
              </div>
              <div class="shrink-0 text-right text-xs">
                <div class="text-lg font-semibold text-indigo-500">{{ item.participantCount ?? 0 }}</div>
                <div class="opacity-50">报名</div>
                <div class="mt-1 opacity-50">{{ item.challengeCount ?? 0 }} 题</div>
              </div>
            </div>
          </n-card>
        </n-gi>
      </n-grid>
    </n-spin>
  </div>
</template>
