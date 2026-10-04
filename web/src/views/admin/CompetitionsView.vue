<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NDataTable, NButton, NSpace, NModal, NForm, NFormItem, NInput, NSelect, NSwitch, NInputNumber, NTag, useMessage } from 'naive-ui';
import { useRouter } from 'vue-router';
import { api } from '../../api';

const message = useMessage();
const router = useRouter();
const loading = ref(false);
const items = ref<any[]>([]);
const editOpen = ref(false);
const form = ref<any>({});

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '名称', key: 'name' },
  { title: '类型', key: 'type', width: 90 },
  { title: '标识', key: 'slug', width: 110 },
  { title: '状态', key: 'state', width: 90 },
  { title: '报名', key: 'participantCount', width: 70 },
  { title: '题目', key: 'challengeCount', width: 70 },
  { title: '服务', key: 'serviceCount', width: 70 },
  { title: '已发布', key: 'published', width: 80, render: (r: any) => (r.published ? '是' : '否') },
];

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>('/api/admin/competitions');
    items.value = data.items;
  } finally {
    loading.value = false;
  }
}

function create() {
  const now = new Date();
  const start = new Date(now.getTime() + 86_400_000);
  const end = new Date(start.getTime() + 8 * 3600_000);
  form.value = {
    name: '', slug: '', subtitle: '', description: '', rules: '', type: 'JEOPARDY', teamMode: 'BOTH',
    startAt: start.toISOString().slice(0, 16), endAt: end.toISOString().slice(0, 16), freezeAt: null,
    published: false, teamSize: [1, 4], maxParticipants: 0, needApproval: false,
    hideScoreboard: false, hideChallenges: false, awdRoundSeconds: 300, awdAttackScore: 50, awdDefensePenalty: 50,
    challengeIds: [],
  };
  editOpen.value = true;
}

async function edit(row: any) {
  form.value = {
    id: row.id, name: row.name, slug: row.slug, type: row.type, teamMode: row.teamMode,
    startAt: new Date(row.startAt).toISOString().slice(0, 16), endAt: new Date(row.endAt).toISOString().slice(0, 16),
    freezeAt: row.freezeAt ? new Date(row.freezeAt).toISOString().slice(0, 16) : null,
    published: row.published, needApproval: row.needApproval, maxParticipants: 0, teamSize: [1, 4],
    awdRoundSeconds: row.awdRoundSeconds, awdAttackScore: row.awdAttackScore, awdDefensePenalty: row.awdDefensePenalty,
    challengeIds: [],
  };
  editOpen.value = true;
}

async function save() {
  const payload: any = {
    ...form.value,
    minTeamSize: form.value.teamSize?.[0] ?? 1,
    maxTeamSize: form.value.teamSize?.[1] ?? 4,
  };
  delete payload.teamSize;
  try {
    if (form.value.id) await api.put(`/api/admin/competitions/${form.value.id}`, payload);
    else await api.post('/api/admin/competitions', payload);
    message.success('已保存');
    editOpen.value = false;
    await load();
  } catch (err: any) {
    message.error(err?.message ?? '保存失败');
  }
}

async function generateRounds(row: any) {
  try {
    const data = await api.post<any>(`/api/admin/competitions/${row.id}/awx-rounds`);
    message.success(`已生成 ${data.rounds} 个回合`);
  } catch (err: any) {
    message.error(err?.message ?? '生成失败');
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-3">
    <n-card size="small"><n-space><n-button type="primary" @click="create">新建比赛</n-button><n-button @click="load">刷新</n-button></n-space></n-card>
    <n-card size="small">
      <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" size="small" :row-key="(r: any) => r.id">
        <template #empty>暂无比赛</template>
      </n-data-table>
      <div class="mt-3 space-y-1">
        <div v-for="row in items" :key="row.id" class="flex flex-wrap items-center gap-2 text-xs">
          <span class="w-40 truncate font-medium">{{ row.name }}</span>
          <n-button size="tiny" @click="edit(row)">编辑</n-button>
          <n-button size="tiny" @click="generateRounds(row)">生成 AWD 回合</n-button>
          <n-button size="tiny" @click="router.push(`/admin/awx/${row.id}`)">AWD 服务</n-button>
          <n-tag size="tiny" :bordered="false">{{ row.roundCount }} 回合 / {{ row.serviceCount }} 服务</n-tag>
        </div>
      </div>
    </n-card>

    <n-modal v-model:show="editOpen" preset="card" :title="form.id ? '编辑比赛' : '新建比赛'" style="max-width: 700px">
      <n-form>
        <n-space>
          <n-form-item label="名称"><n-input v-model:value="form.name" style="width: 220px" /></n-form-item>
          <n-form-item label="标识（URL 用）"><n-input v-model:value="form.slug" style="width: 160px" placeholder="jnctf2026" /></n-form-item>
        </n-space>
        <n-form-item label="副标题"><n-input v-model:value="form.subtitle" /></n-form-item>
        <n-space>
          <n-form-item label="类型"><n-select v-model:value="form.type" style="width: 140px" :options="[{ label: '解题赛', value: 'JEOPARDY' }, { label: 'AWD 攻防', value: 'AWD' }, { label: '混合', value: 'MIXED' }]" /></n-form-item>
          <n-form-item label="参赛方式"><n-select v-model:value="form.teamMode" style="width: 140px" :options="[{ label: '个人', value: 'SOLO' }, { label: '团队', value: 'TEAM' }, { label: '都可', value: 'BOTH' }]" /></n-form-item>
          <n-form-item label="队伍人数"><n-input-number v-model:value="form.teamSize[0]" style="width: 90px" /> ~ <n-input-number v-model:value="form.teamSize[1]" style="width: 90px" /></n-form-item>
        </n-space>
        <n-space>
          <n-form-item label="开始时间"><input :value="form.startAt" type="datetime-local" class="w-[220px] rounded border px-2 py-1 text-sm" @input="(e: any) => form.startAt = e.target.value" /></n-form-item>
          <n-form-item label="结束时间"><input :value="form.endAt" type="datetime-local" class="w-[220px] rounded border px-2 py-1 text-sm" @input="(e: any) => form.endAt = e.target.value" /></n-form-item>
          <n-form-item label="封榜时间"><input :value="form.freezeAt ?? ''" type="datetime-local" class="w-[220px] rounded border px-2 py-1 text-sm" @input="(e: any) => form.freezeAt = e.target.value" /></n-form-item>
        </n-space>
        <n-form-item label="规则（Markdown）"><n-input v-model:value="form.rules" type="textarea" :rows="5" /></n-form-item>
        <n-space>
          <n-form-item label="立即发布"><n-switch v-model:value="form.published" /></n-form-item>
          <n-form-item label="报名需审核"><n-switch v-model:value="form.needApproval" /></n-form-item>
          <n-form-item label="封榜隐藏榜单"><n-switch v-model:value="form.hideScoreboard" /></n-form-item>
          <n-form-item label="开赛前隐藏题目"><n-switch v-model:value="form.hideChallenges" /></n-form-item>
        </n-space>
        <n-space v-if="form.type !== 'JEOPARDY'">
          <n-form-item label="回合时长（秒）"><n-input-number v-model:value="form.awdRoundSeconds" style="width: 130px" /></n-form-item>
          <n-form-item label="攻击得分"><n-input-number v-model:value="form.awdAttackScore" style="width: 120px" /></n-form-item>
          <n-form-item label="被攻破扣分"><n-input-number v-model:value="form.awdDefensePenalty" style="width: 120px" /></n-form-item>
        </n-space>
      </n-form>
      <template #footer>
        <n-space justify="end"><n-button @click="editOpen = false">取消</n-button><n-button type="primary" @click="save">保存</n-button></n-space>
      </template>
    </n-modal>
  </div>
</template>
